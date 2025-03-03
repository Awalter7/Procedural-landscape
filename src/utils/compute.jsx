export class GPUCompute {
    constructor() {
      this.adapter = null;
      this.device = null;
      this.queue = null;
      this.pipeline = null;
      this.bindGroup = null;
  
      // We store references to each GPU buffer, each "result" buffer, etc.
      this.gpuBuffers = [];
      this.resultBuffers = [];
      this.bindGroupEntries = [];
  
      this._code = null;
    }
  
    get code() {
      return this._code;
    }
  
    set code(value) {
      this._code = value;
    }
  
    async init() {
      if (!navigator.gpu) {
        throw new Error("WebGPU not supported on this browser.");
      }
  
      this.adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });

      if (!this.adapter) {
        throw new Error("No appropriate GPUAdapter found.");
      }
  
      this.device = await this.adapter.requestDevice();
      this.queue = this.device.queue;
  
      const shaderModule = this.device.createShaderModule({
        code: this._code,
      });
  
      // Create the compute pipeline
      this.pipeline = this.device.createComputePipeline({
        layout: 'auto',
        compute: {
          module: shaderModule,
          entryPoint: 'main',
        },
      });
    }
  
    /**
     * createResources(bufferInfos):
     * Expects an array of objects describing each buffer. For example:
     * [
     *   { label: "UVUniforms", usage: "uniform", data: Float32Array(...) },
     *   { label: "Positions", usage: "storage", data: Float32Array(...) },
     *   { label: "UVs", usage: "storage", data: Float32Array(...) },
     * ]
     */
    createResources(bufferInfos, from) {
      // Clear out any old references
      this.gpuBuffers = [];
      this.resultBuffers = [];
      this.bindGroupEntries = [];
  
      bufferInfos.forEach((info, index) => {
        const { label, usage, data } = info;
  
        // Byte size of this data
        const byteSize = data.byteLength; // for a Float32Array, length * 4
  
        // Decide WebGPU usage based on "uniform" vs "storage"
        let gpuUsageFlags = 0;
        if (usage === "uniform") {
          // Must include COPY_DST so we can write data in,
          // and COPY_SRC if we plan to copy back out.
          // Typically uniform buffers are small (aligned to 256 bytes).
          gpuUsageFlags = GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
        } else if (usage === "storage") {
          // read_write storage => GPUBufferUsage.STORAGE, plus COPY_DST to upload
          // and COPY_SRC if we want to read it back.
          gpuUsageFlags = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
        } else {
          // fallback
          gpuUsageFlags = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
        }
  
        // Create the GPU buffer for compute
        const gpuBuffer = this.device.createBuffer({
          size: byteSize,
          usage: gpuUsageFlags,
          mappedAtCreation: true,
          label: label,
        });
  
        // Write the input data into that buffer
        const mapping = new Float32Array(gpuBuffer.getMappedRange());
        mapping.set(data);
        gpuBuffer.unmap();
  
        // Create a result buffer if we plan to read from this buffer on CPU
        // (In your case, you probably want the final UVs array. If you also want
        // to read positions/uniforms for debug, keep them too.)
        const resultBuffer = this.device.createBuffer({
          size: byteSize,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
          label: label + "_Result"
        });
  
        this.gpuBuffers.push(gpuBuffer);
        this.resultBuffers.push(resultBuffer);
  
        // This bind group entry will match the binding in WGSL: binding = index
        this.bindGroupEntries.push({
          binding: index,
          resource: {
            buffer: gpuBuffer,
          },
        });
      });
  
      // Create a single bind group with as many entries as we have bufferInfos
      this.bindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        label: from,
        entries: this.bindGroupEntries
      });
    }
  
    /**
     * runComputePass(workgroupCount):
     * Dispatches the compute shader. We copy each GPU buffer to the corresponding
     * "result" buffer so we can mapAsync and read it back on CPU. Then we return
     * an array: one entry for each buffer with { label, data }.
     */
    async runComputePass(workgroupCount = 1) {
      // 1. Encode commands
      const commandEncoder = this.device.createCommandEncoder();
      const passEncoder = commandEncoder.beginComputePass();
  
      passEncoder.setPipeline(this.pipeline);
      passEncoder.setBindGroup(0, this.bindGroup);

      // Dispatch with the user-provided or computed workgroupCount
      passEncoder.dispatchWorkgroups(workgroupCount);
  
      passEncoder.end();
  
      // 2. Copy from each GPU buffer to its corresponding result buffer
      this.gpuBuffers.forEach((buf, i) => {
        commandEncoder.copyBufferToBuffer(
          buf,                   // source
          0,                     // srcOffset
          this.resultBuffers[i], // destination
          0,                     // dstOffset
          this.resultBuffers[i].size
        );
      });
  
      // 3. Submit the commands
      this.queue.submit([commandEncoder.finish()]);
  
      // 4. Read back the data from each result buffer
      const results = [];
      for (let i = 0; i < this.resultBuffers.length; i++) {
        const label = this.bindGroupEntries[i].resource.buffer.label || `Buffer_${i}`;
        await this.resultBuffers[i].mapAsync(GPUMapMode.READ);
        if (this.resultBuffers[i].mapState === 'mapped') {
            const copyArrayBuffer = this.resultBuffers[i].getMappedRange();
            const floatData = new Float32Array(copyArrayBuffer.slice(0));
            this.resultBuffers[i].unmap();
      
            results.push({
              label,
              data: floatData,
            });
        }   
      }
  
      return results;
    }
  }
  
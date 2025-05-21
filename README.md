# Procedural-landscape

A React application that generates a 3D procedural terrain in the browser using **React Three Fiber**, **Three.js**, and noise-based height mapping.
---
![image](https://github.com/user-attachments/assets/b3457ee9-1b03-4afd-a669-ab8dd9f73576)
---

## Table of Contents

1. [Features](#features)  
2. [Tech Stack](#tech-stack)  
3. [Getting Started](#getting-started)  
   - [Prerequisites](#prerequisites)  
   - [Installation](#installation)  
   - [Running in Development](#running-in-development)  
   - [Building for Production](#building-for-production)  
6. [Usage](#usage)  
7. [Contributing](#contributing)  
8. [License](#license)  

---

## Features

- **Procedural Terrain Generation**  
  - Generates a mesh whose vertices are displaced by Perlin/Simplex noise.  
- **Interactive Controls**  
  - OrbitControls for camera rotation, pan and zoom.  
- **Realtime Parameter Tuning**  
  - Easy to tweak noise scale, amplitude, octaves, etc., directly in code.
- **GPU Comput**
  - Fast mesh re-generation upon parameter changes. 
- **Responsive Canvas**  
  - Automatically fills the viewport with correct aspect ratio.  

---

## Tech Stack

- **React** 19  
- **TypeScript** 5.7.2  
- **Create React App** (react-scripts 5.0.1)  
- **Three.js** 0.174.0  
- **@react-three/fiber** 9.0.4  
- **@react-three/drei** 10.0.3  
- **simplex-noise** 4.0.3  
- **seedrandom** 3.0.5  
- **dat.gui** 0.7.9  

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v14+ recommended)  
- [npm](https://npmjs.com) _or_ [Yarn](https://yarnpkg.com)  

### Installation

# Clone the repo
git clone https://github.com/Awalter7/Procedural-landscape.git
cd Procedural-landscape

# Install dependencies
npm install
# or
yarn install

# If using Create React App
npm start

# If using Vite
npm run dev

### Running in Development
npm start

### Building for Production
npm run build

Built files will be in the `build/` directory.

Then open [http://localhost:3000](http://localhost:3000) in your browser.

# Usage
- Asjust terrain settings in GUI

# Contributing
  1. Fork the repo
  2. Create a branch (git checkout -b feat/your-feature)
  3. Commit your changes (git commit -m "feat: …")
  4. Push (git push origin feat/your-feature)
  5. Open a PR
     
# License
This project is licensed under the MIT License. See LICENSE for details.

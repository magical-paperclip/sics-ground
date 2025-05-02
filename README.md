# sics-ground: the internet's favorite phys. playground

an intuitive physics sandbox built on matter.js allows you to experiment with realistic object interactions, create shapes, watch them collide, and explore dynamic effects—all in real time.

## features
- real-time physics simulation with matter.js
- four unique colision effects:
  - bounce: enhanced elastic colisions with visual feedback
  - explode: particle-based explosions, scaled to impact force
  - stick: attractive forces between colliding objects
  - gravity shift: dynamic gravity changes upon collision
- interactive shape creation:
  - easily add cirlces, squares, and polygons
  - click anywhere on the canvas to generate random shapes
- advanced particle systems:
  - custom explosion particles with diverse behaviors
  - motion trails for fast-moving objects
  - entry and collision animations
- optimized rendering for hidpi/retina displays

## technical implementation
### physics engine
built on matter.js with enhanced colision and response settings.

### rendering pipeline
utilizes:
- matter.js native renderer for physics bodies
- custom canvas api for particle effects
- css animations for ui elements  
optimized with:
- adaptive pixel ratio detection for retina displays
- batch rendering for particle systems
- selective updates based on visibility

### particle system architecture
- efficient memory pooling to maintain 60 fps
- optimized particle behaviors for smooth performance

### event handling
combines:
- matter.js events module for physics interactions
- dom events for user engagement
- intersectionobserver api for scroll-based triggers

## performance optimizations
- object pooling minimizes gc pauses
- selective rendering boosts performance
- sleep optimization for static bodies
- fixed timestep ensures consistent physics
- viewport-based pause/resume saves cpu when not visible

## future enhancements
- webgl renderer for enhanced graphics
- physics constraint tool for joints/connections
- touch optimization for mobile devices
- physics presets for educational demos
- export/import system for sharing creations

---

created by @magical-paperclip  📎🪄

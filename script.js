// Initialize Matter.js modules
const { Engine, Render, Runner, Body, Bodies, Composite, Events, Mouse, MouseConstraint, Common, Vector } = Matter;

// Create engine and world with better settings for smooth physics
const engine = Engine.create({
    positionIterations: 8,    // Increased from default 6 for more accurate positioning
    velocityIterations: 8,    // Increased from default 4 for smoother motion
    constraintIterations: 4,  // Increased for better constraint solving
    enableSleeping: true      // Allow objects to "sleep" when not moving for better performance
});
const world = engine.world;

// Set smoother gravity
world.gravity.scale = 0.001;
world.gravity.y = 1;

// Canvas setup with HiDPI/Retina support
const canvas = document.getElementById('physics-canvas');
const canvasContainer = document.querySelector('.canvas-container');
const pixelRatio = window.devicePixelRatio || 1;
canvas.width = canvasContainer.offsetWidth * pixelRatio;
canvas.height = canvasContainer.offsetHeight * pixelRatio;
canvas.style.width = `${canvasContainer.offsetWidth}px`;
canvas.style.height = `${canvasContainer.offsetHeight}px`;

// Create renderer with improved settings
const render = Render.create({
    canvas: canvas,
    engine: engine,
    options: {
        width: canvas.width,
        height: canvas.height,
        wireframes: false,
        background: 'rgba(41, 40, 65, 0.7)',
        showAngleIndicator: false,
        pixelRatio: pixelRatio,
        hasBounds: true
    }
});

// Run the engine with a smooth, fixed time step
const runner = Runner.create({
    isFixed: true,
    delta: 1000/60 // Lock to 60 FPS for consistency
});
Runner.run(runner, engine);
Render.run(render);

// Variables
let activeBodies = [];
let boundaries = [];
let explosionParticles = [];
let trailParticles = [];
let currentEffect = 'bounce';
const colors = ['#716040', '#8c7851', '#a88c64', '#d1c4b3', '#d0b49f'];
const explosionColors = ['#ff7b54', '#ffb26b', '#ffd56b', '#939597', '#6c22bd'];

// Create smoother boundaries with rounded corners
function createBoundaries() {
    const wallOptions = { 
        isStatic: true,
        chamfer: { radius: 10 }, // Round the corners
        render: { 
            fillStyle: 'rgba(224, 214, 204, 0.8)',
            strokeStyle: 'rgba(209, 196, 179, 0.5)',
            lineWidth: 1
        } 
    };
    
    // Create smoother walls and ground
    const groundHeight = 30;
    const wallWidth = 30;
    
    // Create ground with slightly increased thickness
    const ground = Bodies.rectangle(
        canvas.width / 2, 
        canvas.height - groundHeight/2, 
        canvas.width, 
        groundHeight, 
        wallOptions
    );
    
    // Create base platform above ground to catch shapes that might slip through
    const basePlatform = Bodies.rectangle(
        canvas.width / 2,
        canvas.height - groundHeight - 5,
        canvas.width - 4,
        10,
        {
            isStatic: true,
            render: {
                fillStyle: 'rgba(224, 214, 204, 0.4)',
                strokeStyle: 'rgba(209, 196, 179, 0.3)',
                lineWidth: 1
            }
        }
    );
    
    const leftWall = Bodies.rectangle(wallWidth/2, canvas.height / 2, wallWidth, canvas.height, wallOptions);
    const rightWall = Bodies.rectangle(canvas.width - wallWidth/2, canvas.height / 2, wallWidth, canvas.height, wallOptions);
    const ceiling = Bodies.rectangle(canvas.width / 2, wallWidth/2, canvas.width, wallWidth, wallOptions);
    
    boundaries = [ground, basePlatform, leftWall, rightWall, ceiling];
    Composite.add(world, boundaries);
}

// Create a random body with improved physics settings
function createBody(x, y, type) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    const options = {
        restitution: 0.8,         // Bouncier
        friction: 0.05,           // Less friction for smoother sliding
        frictionAir: 0.002,       // Slight air resistance for more natural movement
        frictionStatic: 0.2,      // Easier to get moving
        density: 0.002,           // Lower density for more responsive physics
        chamfer: { radius: 2 },   // Slightly rounded corners for smoother collisions
        render: {
            fillStyle: color,
            strokeStyle: '#716040',
            lineWidth: 1
        }
    };
    
    let body;
    
    switch(type) {
        case 'circle':
            body = Bodies.circle(x, y, Common.random(15, 30), options);
            break;
        case 'square':
            const size = Common.random(25, 50);
            body = Bodies.rectangle(x, y, size, size, options);
            break;
        case 'polygon':
            body = Bodies.polygon(x, y, Common.random(3, 6), Common.random(15, 30), options);
            break;
        default:
            body = Bodies.circle(x, y, Common.random(15, 30), options);
    }
    
    // Add some initial velocity for smoother entry
    Body.setVelocity(body, { 
        x: Common.random(-1, 1) * 2,
        y: Common.random(-0.1, 0.1)
    });
    
    activeBodies.push(body);
    Composite.add(world, body);
    
    // Add entry animation effect
    createRippleEffect(x, y);
    
    return body;
}

// Create ripple effect when adding a new body
function createRippleEffect(x, y) {
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const distance = 15;
        
        const ripple = createExplosionParticle(
            x + Math.cos(angle) * distance,
            y + Math.sin(angle) * distance,
            '#ffffff',
            5,
            0.8,
            angle
        );
        
        ripple.maxLifespan = 30;
        ripple.lifespan = 30;
        ripple.velocity.x *= 0.7;
        ripple.velocity.y *= 0.7;
        
        explosionParticles.push(ripple);
    }
}

// Create visual effect particles with improved smoothness
function createExplosionParticle(x, y, color, size, speed, angle) {
    return {
        x,
        y,
        size,
        color,
        velocity: {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        },
        alpha: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.1, // Slower rotation for smoother look
        lifespan: 60,
        maxLifespan: 60,
        gravity: 0.02,
        drag: 0.98
    };
}

// Create trail particle for shape movement
function createTrailParticle(x, y, color, size) {
    return {
        x,
        y,
        size,
        color,
        alpha: 0.7,
        lifespan: 20,
        maxLifespan: 20
    };
}

// Render explosion particles with anti-aliasing and smooth transitions
function renderExplosionParticles(render) {
    const context = render.context;
    
    // Enable settings for smoother rendering
    context.globalCompositeOperation = 'lighter';
    
    explosionParticles.forEach(particle => {
        context.save();
        context.globalAlpha = particle.alpha;
        context.translate(particle.x, particle.y);
        context.rotate(particle.rotation);
        
        // Draw different shapes with smooth edges
        const shapePicker = Math.floor(particle.size) % 3;
        
        // Add glow effect for smoother looking particles
        const glow = context.createRadialGradient(0, 0, 0, 0, 0, particle.size * 1.2);
        glow.addColorStop(0, particle.color);
        glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        switch(shapePicker) {
            case 0: // Circle
                context.beginPath();
                context.arc(0, 0, particle.size, 0, Math.PI * 2);
                context.fillStyle = glow;
                context.fill();
                break;
                
            case 1: // Square
                context.fillStyle = glow;
                context.fillRect(-particle.size/2, -particle.size/2, particle.size, particle.size);
                break;
                
            case 2: // Triangle
                context.beginPath();
                context.moveTo(0, -particle.size);
                context.lineTo(particle.size, particle.size);
                context.lineTo(-particle.size, particle.size);
                context.closePath();
                context.fillStyle = glow;
                context.fill();
                break;
        }
        
        context.restore();
    });
    
    // Render trail particles
    context.globalCompositeOperation = 'source-over';
    trailParticles.forEach(particle => {
        context.save();
        context.globalAlpha = particle.alpha * (particle.lifespan / particle.maxLifespan);
        
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fillStyle = particle.color;
        context.fill();
        
        context.restore();
    });
}

// Update explosion particles with smoother physics
function updateExplosionParticles() {
    for (let i = explosionParticles.length - 1; i >= 0; i--) {
        const particle = explosionParticles[i];
        
        // Update position with smoother easing
        particle.x += particle.velocity.x;
        particle.y += particle.velocity.y;
        
        // Add some gravity with easing
        particle.velocity.y += particle.gravity;
        
        // Slow down particles over time with drag
        particle.velocity.x *= particle.drag;
        particle.velocity.y *= particle.drag;
        
        // Update rotation with smooth interpolation
        particle.rotation += particle.rotationSpeed;
        
        // Reduce size with easing
        particle.size *= 0.99;
        
        // Update lifespan and alpha with easing
        particle.lifespan--;
        particle.alpha = (particle.lifespan / particle.maxLifespan) * (particle.lifespan / particle.maxLifespan); // Quadratic easing
        
        // Remove dead particles
        if (particle.lifespan <= 0 || particle.size < 0.5) {
            explosionParticles.splice(i, 1);
        }
    }
    
    // Update trail particles
    for (let i = trailParticles.length - 1; i >= 0; i--) {
        const particle = trailParticles[i];
        particle.lifespan--;
        
        if (particle.lifespan <= 0) {
            trailParticles.splice(i, 1);
        }
    }
    
    // Add trail particles to moving bodies for smoother visuals
    if (Math.random() < 0.3) { // Only add trails occasionally for performance
        activeBodies.forEach(body => {
            if (Vector.magnitude(body.velocity) > 1) {
                const speed = Vector.magnitude(body.velocity);
                
                if (speed > 2) { // Only trail fast-moving objects
                    const pos = body.position;
                    const trailColor = body.render.fillStyle;
                    const size = Math.min(5, Math.max(1, speed / 5));
                    
                    trailParticles.push(createTrailParticle(
                        pos.x, 
                        pos.y,
                        trailColor,
                        size
                    ));
                }
            }
        });
    }
}

// Create a smoother explosion
function createExplosion(x, y, intensity = 1) {
    const particleCount = Math.floor(25 * intensity);
    const baseSize = 3 + (intensity * 2);
    const baseSpeed = 1 + (intensity * 1.5);
    
    // Create main explosion particles
    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 10 * intensity;
        const size = baseSize + Math.random() * 6;
        
        // Vary the speed based on particle size for more natural looking explosion
        const speedVariation = 1 - (size / (baseSize + 6)) * 0.5;
        const speed = baseSpeed * speedVariation + Math.random() * 2;
        
        const color = explosionColors[Math.floor(Math.random() * explosionColors.length)];
        
        const particle = createExplosionParticle(
            x + Math.cos(angle) * distance,
            y + Math.sin(angle) * distance,
            color,
            size,
            speed,
            angle
        );
        
        // Add random variation to lifespans for more natural fading
        const lifespanVariation = 0.8 + Math.random() * 0.4;
        particle.lifespan = Math.floor(60 * lifespanVariation);
        particle.maxLifespan = particle.lifespan;
        
        explosionParticles.push(particle);
    }
    
    // Add some tiny sparks for additional effect
    for (let i = 0; i < particleCount/2; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = baseSpeed * 1.5 + Math.random() * 3;
        const sparkSize = 1 + Math.random() * 2;
        
        const spark = createExplosionParticle(
            x,
            y,
            '#ffffff',
            sparkSize,
            speed,
            angle
        );
        
        // Make sparks fade faster and more dynamically
        const sparkLifespan = 20 + Math.floor(Math.random() * 20);
        spark.maxLifespan = sparkLifespan;
        spark.lifespan = sparkLifespan;
        spark.gravity = 0.01; // Less gravity on sparks
        
        explosionParticles.push(spark);
    }
    
    // Add shockwave effect
    for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2;
        const shockwave = createExplosionParticle(
            x,
            y,
            'rgba(255, 255, 255, 0.5)',
            2 + intensity * 2,
            2 + intensity,
            angle
        );
        
        shockwave.maxLifespan = 15;
        shockwave.lifespan = 15;
        shockwave.gravity = 0;
        
        explosionParticles.push(shockwave);
    }
}

// Handle collision effects with smoother transitions
function handleCollision(event) {
    const pairs = event.pairs;
    
    for (let i = 0; i < pairs.length; i++) {
        const bodyA = pairs[i].bodyA;
        const bodyB = pairs[i].bodyB;
        
        // Calculate collision strength for proportional effects
        const relativeVelocity = {
            x: bodyA.velocity.x - bodyB.velocity.x,
            y: bodyA.velocity.y - bodyB.velocity.y
        };
        const collisionSpeed = Math.sqrt(relativeVelocity.x * relativeVelocity.x + relativeVelocity.y * relativeVelocity.y);
        const impactThreshold = 2; // Minimum speed for effects
        
        // Skip if collision is too gentle or between boundaries
        if (collisionSpeed < impactThreshold || (boundaries.includes(bodyA) && boundaries.includes(bodyB))) {
            continue;
        }
        
        // Normalized impact force (0-1 range)
        const impactForce = Math.min(1, collisionSpeed / 10);
        
        // Collision point
        const midX = (bodyA.position.x + bodyB.position.x) / 2;
        const midY = (bodyA.position.y + bodyB.position.y) / 2;
        
        // Apply different collision effects based on selection
        switch(currentEffect) {
            case 'bounce':
                // Enhanced bounce with smooth scaling
                if (!boundaries.includes(bodyA)) {
                    const velocityA = Vector.mult(Vector.normalise(bodyA.velocity), bodyA.speed * (1 + impactForce * 0.3));
                    Body.setVelocity(bodyA, velocityA);
                }
                if (!boundaries.includes(bodyB)) {
                    const velocityB = Vector.mult(Vector.normalise(bodyB.velocity), bodyB.speed * (1 + impactForce * 0.3));
                    Body.setVelocity(bodyB, velocityB);
                }
                
                // Add tiny spark at collision point for visual feedback
                if (impactForce > 0.3) {
                    for (let j = 0; j < 3; j++) {
                        const sparkAngle = Math.random() * Math.PI * 2;
                        const spark = createExplosionParticle(
                            midX, midY, 
                            '#ffffff', 
                            1 + impactForce * 2,
                            1 + impactForce * 2, 
                            sparkAngle
                        );
                        spark.maxLifespan = 10;
                        spark.lifespan = 10;
                        explosionParticles.push(spark);
                    }
                }
                break;
                
            case 'explode':
                // Create smooth visual explosion effect
                if (!boundaries.includes(bodyA) && !boundaries.includes(bodyB)) {
                    // Create visual explosion scaled by impact force
                    const intensity = 0.5 + impactForce * 2.5;
                    createExplosion(midX, midY, intensity);
                    
                    // Create physical particles
                    const particleCount = Math.floor(impactForce * 4) + 1;
                    for (let j = 0; j < particleCount; j++) {
                        const particle = Bodies.circle(
                            midX + Common.random(-5, 5),
                            midY + Common.random(-5, 5),
                            Common.random(2, 4 + impactForce * 2),
                            {
                                restitution: 0.8,
                                friction: 0.05,
                                frictionAir: 0.005,
                                render: {
                                    fillStyle: explosionColors[Math.floor(Math.random() * explosionColors.length)],
                                    opacity: 0.8
                                }
                            }
                        );
                        
                        // Scale force by impact strength
                        const forceMagnitude = 0.01 + (impactForce * 0.03);
                        const angle = Math.random() * Math.PI * 2;
                        Body.applyForce(particle, particle.position, {
                            x: forceMagnitude * Math.cos(angle),
                            y: forceMagnitude * Math.sin(angle)
                        });
                        
                        activeBodies.push(particle);
                        Composite.add(world, particle);
                        
                        // Remove particles with a slight delay variance
                        const removeDelay = 1500 + Math.random() * 1000;
                        setTimeout(() => {
                            if (activeBodies.includes(particle)) {
                                // Fade out particles before removing them
                                const fadeInterval = setInterval(() => {
                                    if (particle.render.opacity > 0.1) {
                                        particle.render.opacity -= 0.1;
                                    } else {
                                        clearInterval(fadeInterval);
                                        Composite.remove(world, particle);
                                        activeBodies = activeBodies.filter(body => body !== particle);
                                    }
                                }, 50);
                            }
                        }, removeDelay);
                    }
                }
                break;
                
            case 'stick':
                // Make bodies stick together with smooth attraction
                if (!boundaries.includes(bodyA) && !boundaries.includes(bodyB)) {
                    // Scale force by body mass and impact
                    const baseForce = 0.0005;
                    const forceMagnitude = baseForce * (1 + impactForce);
                    
                    const direction = Vector.sub(bodyB.position, bodyA.position);
                    const distance = Vector.magnitude(direction);
                    
                    if (distance > 0) {
                        const normalizedDirection = Vector.normalise(direction);
                        
                        // Apply scaled forces
                        Body.applyForce(bodyA, bodyA.position, 
                            Vector.mult(normalizedDirection, forceMagnitude * bodyA.mass));
                        
                        Body.applyForce(bodyB, bodyB.position, 
                            Vector.mult(normalizedDirection, -forceMagnitude * bodyB.mass));
                        
                        // Add visual connection effect
                        if (Math.random() < 0.2) {
                            const particlePos = Vector.add(
                                bodyA.position,
                                Vector.mult(normalizedDirection, distance * 0.3)
                            );
                            
                            const connectionParticle = createExplosionParticle(
                                particlePos.x, 
                                particlePos.y,
                                'rgba(61, 220, 132, 0.7)',
                                2 + Math.random() * 2,
                                0.2,
                                Math.random() * Math.PI * 2
                            );
                            
                            connectionParticle.maxLifespan = 20;
                            connectionParticle.lifespan = 20;
                            connectionParticle.gravity = 0;
                            
                            explosionParticles.push(connectionParticle);
                        }
                    }
                }
                break;
                
            case 'gravity':
                // Smoothly change gravity direction on collision
                if (!boundaries.includes(bodyA) || !boundaries.includes(bodyB)) {
                    // Generate random angle weighted by impact force
                    const startAngle = Math.atan2(world.gravity.y, world.gravity.x);
                    const angleChange = (Math.random() - 0.5) * Math.PI * impactForce * 2;
                    const newAngle = startAngle + angleChange;
                    
                    // Store current gravity values
                    const oldGravityX = world.gravity.x;
                    const oldGravityY = world.gravity.y;
                    
                    // Target gravity values
                    const targetGravityX = Math.sin(newAngle) * 0.001;
                    const targetGravityY = Math.cos(newAngle) * 0.001;
                    
                    // Smoothly transition gravity
                    const transitionSteps = 20;
                    const transitionDelay = 50;
                    
                    for (let step = 0; step <= transitionSteps; step++) {
                        setTimeout(() => {
                            const progress = step / transitionSteps;
                            // Use easeInOutQuad for smooth transition
                            const easing = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                            
                            world.gravity.x = oldGravityX + (targetGravityX - oldGravityX) * easing;
                            world.gravity.y = oldGravityY + (targetGravityY - oldGravityY) * easing;
                        }, step * transitionDelay);
                    }
                    
                    // Gravity wave visual effect
                    for (let i = 0; i < 24; i++) {
                        const angle = (i / 24) * Math.PI * 2;
                        const gravityWave = createExplosionParticle(
                            midX,
                            midY,
                            'rgba(108, 34, 189, 0.4)',
                            5 + Math.random() * 5,
                            0.5 + impactForce,
                            angle
                        );
                        
                        gravityWave.maxLifespan = 30;
                        gravityWave.lifespan = 30;
                        gravityWave.gravity = 0;
                        
                        explosionParticles.push(gravityWave);
                    }
                    
                    // Reset gravity after a delay with smooth transition back
                    const resetDelay = 1500 + impactForce * 1000;
                    setTimeout(() => {
                        const finalGravityX = world.gravity.x;
                        const finalGravityY = world.gravity.y;
                        
                        for (let step = 0; step <= transitionSteps; step++) {
                            setTimeout(() => {
                                const progress = step / transitionSteps;
                                // Use easeInOutQuad for smooth transition
                                const easing = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                                
                                world.gravity.x = finalGravityX * (1 - easing);
                                world.gravity.y = 1 * easing + finalGravityY * (1 - easing);
                            }, step * transitionDelay);
                        }
                    }, resetDelay);
                }
                break;
        }
    }
}

// Custom render function with smoother animations
Events.on(render, 'afterRender', function() {
    updateExplosionParticles();
    renderExplosionParticles(render);
});

// Event listeners for smoother collision detection
Events.on(engine, 'collisionStart', handleCollision);

// Smoother mouse controls
const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
        stiffness: 0.1,  // Softer constraint for smoother dragging
        damping: 0.1,    // Add damping for smoother movement
        render: {
            visible: false
        }
    }
});

// Scale mouse position for retina displays
mouse.pixelRatio = pixelRatio;

Composite.add(world, mouseConstraint);
render.mouse = mouse;

// Add a smooth grabbing animation when using mouse
Events.on(mouseConstraint, 'startdrag', function(event) {
    const body = event.body;
    createRippleEffect(body.position.x, body.position.y);
});

// Setup event listeners for buttons with smoother transitions
document.querySelectorAll('.effect-btn').forEach(button => {
    button.addEventListener('click', () => {
        // Update active effect with visual feedback
        document.querySelectorAll('.effect-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        const newEffect = button.getAttribute('data-effect');
        
        // Only add effect if changing
        if (newEffect !== currentEffect) {
            currentEffect = newEffect;
            
            // Add visual ripple in canvas to indicate mode change
            const x = canvas.width / (2 * pixelRatio);
            const y = canvas.height / (2 * pixelRatio);
            
            // Different colors for different effects
            let effectColor;
            switch(currentEffect) {
                case 'bounce': effectColor = '#3ddc84'; break;
                case 'explode': effectColor = '#ff7b54'; break;
                case 'stick': effectColor = '#6c22bd'; break;
                case 'gravity': effectColor = '#ffb26b'; break;
                default: effectColor = '#ffffff';
            }
            
            // Create mode change effect
            for (let i = 0; i < 36; i++) {
                const angle = (i / 36) * Math.PI * 2;
                const modeParticle = createExplosionParticle(
                    x, y,
                    effectColor,
                    8,
                    3,
                    angle
                );
                
                modeParticle.maxLifespan = 40;
                modeParticle.lifespan = 40;
                modeParticle.gravity = 0;
                
                explosionParticles.push(modeParticle);
            }
        }
    });
});

// Setup add shape buttons with smoother object creation
document.getElementById('add-circle').addEventListener('click', () => {
    createBody(canvas.width / (2 * pixelRatio), 50, 'circle');
});

document.getElementById('add-square').addEventListener('click', () => {
    createBody(canvas.width / (2 * pixelRatio), 50, 'square');
});

document.getElementById('add-polygon').addEventListener('click', () => {
    createBody(canvas.width / (2 * pixelRatio), 50, 'polygon');
});

// Reset scene with smooth animation
document.getElementById('reset-scene').addEventListener('click', () => {
    // Animate removal of bodies for smoother effect
    const removalDelay = 20;
    
    activeBodies.forEach((body, index) => {
        setTimeout(() => {
            // Create a small explosion where the body was
            createExplosion(body.position.x, body.position.y, 0.5);
            
            // Remove the body
            Composite.remove(world, body);
            
            // If this is the last body, clear the array
            if (index === activeBodies.length - 1) {
                activeBodies = [];
            }
        }, index * removalDelay);
    });
    
    // Reset gravity with a smooth transition
    const steps = 20;
    const currentGravX = world.gravity.x;
    const currentGravY = world.gravity.y;
    
    for (let i = 0; i <= steps; i++) {
        setTimeout(() => {
            const progress = i / steps;
            world.gravity.x = currentGravX * (1 - progress);
            world.gravity.y = currentGravY * (1 - progress) + progress;
        }, i * 20);
    }
});

// Toggle gravity with smooth transition
document.getElementById('toggle-gravity').addEventListener('click', () => {
    const targetY = world.gravity.y === 1 ? 0 : 1;
    const currentY = world.gravity.y;
    const steps = 15;
    
    for (let i = 0; i <= steps; i++) {
        setTimeout(() => {
            const progress = i / steps;
            // Use easing function for smoother transition
            const easing = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            world.gravity.y = currentY + (targetY - currentY) * easing;
        }, i * 20);
    }
    
    // Visual feedback for gravity change
    const x = canvas.width / (2 * pixelRatio);
    const y = canvas.height / (2 * pixelRatio);
    
    for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2;
        const gravParticle = createExplosionParticle(
            x, y,
            targetY === 0 ? 'rgba(61, 220, 132, 0.7)' : 'rgba(108, 34, 189, 0.7)',
            5,
            2,
            angle
        );
        
        gravParticle.maxLifespan = 30;
        gravParticle.lifespan = 30;
        gravParticle.gravity = 0;
        
        explosionParticles.push(gravParticle);
    }
});

// Handle resize with smoother transitions
window.addEventListener('resize', () => {
    // Remove old boundaries
    boundaries.forEach(boundary => {
        Composite.remove(world, boundary);
    });
    
    // Update canvas dimensions
    canvas.width = canvasContainer.offsetWidth * pixelRatio;
    canvas.height = canvasContainer.offsetHeight * pixelRatio;
    canvas.style.width = `${canvasContainer.offsetWidth}px`;
    canvas.style.height = `${canvasContainer.offsetHeight}px`;
    
    // Update renderer dimensions
    render.options.width = canvas.width;
    render.options.height = canvas.height;
    
    // Create new boundaries
    createBoundaries();
});

// Add click handler for canvas to create random shapes
canvas.addEventListener('click', (event) => {
    // Prevent click from being captured if we're dragging an object
    if (mouseConstraint.body) {
        return;
    }
    
    // Get click position relative to canvas, adjusted for pixelRatio
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * pixelRatio;
    const y = (event.clientY - rect.top) * pixelRatio;
    
    // Create a random shape at click position
    const shapeTypes = ['circle', 'square', 'polygon'];
    const randomType = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];
    
    // Create the body with a small animation
    createBody(x, y, randomType);
    
    // Add a larger ripple effect for visual feedback
    for (let i = 0; i < 8; i++) {
        setTimeout(() => {
            createRippleEffect(x, y);
        }, i * 30);
    }
});

// Initialize playground
createBoundaries();

// Add initial bodies with staggered timing for smoother startup
for (let i = 0; i < 5; i++) {
    setTimeout(() => {
        const x = Common.random(100, canvas.width / pixelRatio - 100);
        const y = Common.random(50, 100);
        const type = ['circle', 'square', 'polygon'][Math.floor(Math.random() * 3)];
        createBody(x, y, type);
    }, i * 200); // Stagger creation for smoother start
}
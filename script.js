// Wait for the DOM to be fully loaded before initializing the physics playground
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the network background
    initNetworkBackground();
    
    const { Engine, Render, Runner, Body, Bodies, Composite, Events, Mouse, MouseConstraint, Common, Vector } = Matter;

    const engine = Engine.create({
        positionIterations: 8,    
        velocityIterations: 8,    
        constraintIterations: 4,  
        enableSleeping: true      
    });
    const world = engine.world;

    world.gravity.scale = 0.001;
    world.gravity.y = 1;

    // Canvas setup with HiDPI/Retina support
    const canvas = document.getElementById('physics-canvas');
    const canvasContainer = document.querySelector('.canvas-container');
    
    // Debug logging to help identify issues
    console.log('Canvas element:', canvas);
    console.log('Canvas container:', canvasContainer);
    
    if (!canvas || !canvasContainer) {
        console.error('Canvas or container elements not found!');
        return;
    }
    
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = canvasContainer.offsetWidth * pixelRatio;
    canvas.height = canvasContainer.offsetHeight * pixelRatio;
    canvas.style.width = `${canvasContainer.offsetWidth}px`;
    canvas.style.height = `${canvasContainer.offsetHeight}px`;

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

    const runner = Runner.create({
        isFixed: true,
        delta: 1000/60 
    });
    Runner.run(runner, engine);
    Render.run(render);

    let activeBodies = [];
    let boundaries = [];
    let explosionParticles = [];
    let trailParticles = [];
    let currentEffect = 'bounce';
    const colors = ['#716040', '#8c7851', '#a88c64', '#d1c4b3', '#d0b49f'];
    const explosionColors = ['#ff7b54', '#ffb26b', '#ffd56b', '#939597', '#6c22bd'];

    function createBoundaries() {
        const wallOptions = { 
            isStatic: true,
            chamfer: { radius: 10 }, 
            render: { 
                fillStyle: 'rgba(224, 214, 204, 0.8)',
                strokeStyle: 'rgba(209, 196, 179, 0.5)',
                lineWidth: 1
            } 
        };
        
        const groundHeight = 30;
        const wallWidth = 30;
        
        // Main ground at the bottom
        const ground = Bodies.rectangle(
            canvas.width / 2, 
            canvas.height - groundHeight/2, 
            canvas.width, 
            groundHeight, 
            wallOptions
        );
        
        // Improved base platform that objects can rest on
        const basePlatformOptions = {
            isStatic: true,
            chamfer: { radius: 5 },
            render: {
                fillStyle: 'rgba(150, 140, 130, 0.9)',
                strokeStyle: '#8c7851',
                lineWidth: 2
            },
            friction: 0.3,           // Increased friction to prevent sliding
            frictionStatic: 0.5,     // Higher static friction
            restitution: 0.2,        // Less bouncy
            slop: 0.1,               // Better collision handling
            collisionFilter: {       // Ensure it collides with objects properly
                category: 0x0001,
                mask: 0xFFFFFFFF
            }
        };
        
        // Position the platform higher up from the ground (30px instead of 5px)
        const basePlatform = Bodies.rectangle(
            canvas.width / 2,
            canvas.height - groundHeight - 30,
            canvas.width - 120,
            20,
            basePlatformOptions
        );
        
        // Create visible supports connecting platform to ground
        const leftSupport = Bodies.rectangle(
            canvas.width / 2 - (canvas.width - 180) / 4,
            canvas.height - groundHeight - 15,
            15,
            30,
            {
                isStatic: true,
                render: {
                    fillStyle: 'rgba(140, 120, 81, 0.9)',
                    strokeStyle: '#716040',
                    lineWidth: 1
                }
            }
        );
        
        const rightSupport = Bodies.rectangle(
            canvas.width / 2 + (canvas.width - 180) / 4,
            canvas.height - groundHeight - 15,
            15,
            30,
            {
                isStatic: true,
                render: {
                    fillStyle: 'rgba(140, 120, 81, 0.9)',
                    strokeStyle: '#716040',
                    lineWidth: 1
                }
            }
        );
        
        const leftWall = Bodies.rectangle(wallWidth/2, canvas.height / 2, wallWidth, canvas.height, wallOptions);
        const rightWall = Bodies.rectangle(canvas.width - wallWidth/2, canvas.height / 2, wallWidth, canvas.height, wallOptions);
        const ceiling = Bodies.rectangle(canvas.width / 2, wallWidth/2, canvas.width, wallWidth, wallOptions);
        
        // Add all boundaries including the supports
        boundaries = [ground, basePlatform, leftSupport, rightSupport, leftWall, rightWall, ceiling];
        Composite.add(world, boundaries);
        
        // Create angled ramps on the left and right of the platform
        const rampOptions = {
            isStatic: true,
            chamfer: { radius: 2 },
            render: {
                fillStyle: 'rgba(209, 196, 179, 0.8)',
                strokeStyle: '#716040',
                lineWidth: 1
            },
            friction: 0.1,
            restitution: 0.1
        };
        
        // Left ramp
        const leftRamp = Bodies.rectangle(
            basePlatform.position.x - (canvas.width - 120) / 2 - 30,
            basePlatform.position.y + 15,
            80,
            10,
            rampOptions
        );
        
        // Rotate left ramp
        Body.rotate(leftRamp, Math.PI / 8);
        
        // Right ramp
        const rightRamp = Bodies.rectangle(
            basePlatform.position.x + (canvas.width - 120) / 2 + 30,
            basePlatform.position.y + 15,
            80,
            10,
            rampOptions
        );
        
        // Rotate right ramp
        Body.rotate(rightRamp, -Math.PI / 8);
        
        // Add ramps to boundaries and world
        boundaries.push(leftRamp, rightRamp);
        Composite.add(world, [leftRamp, rightRamp]);
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
        }, i * 200);
    }
});

// Particle network background
function initNetworkBackground() {
    const canvas = document.getElementById('network-background');
    const ctx = canvas.getContext('2d');
    const container = document.querySelector('.canvas-container');
    
    // Set canvas size
    const resizeCanvas = () => {
        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = container.offsetWidth * pixelRatio;
        canvas.height = container.offsetHeight * pixelRatio;
        canvas.style.width = `${container.offsetWidth}px`;
        canvas.style.height = `${container.offsetHeight}px`;
        ctx.scale(pixelRatio, pixelRatio);
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Particle settings
    const particleCount = 80;
    const maxDistance = 150;
    const lineOpacity = 0.15;
    const dotOpacity = 0.4;
    const particleSpeed = 0.3;
    const mouseRadius = 150; // Radius of mouse influence
    const mouseForce = 2;    // Strength of mouse influence
    
    // Colors
    const colors = [
        'rgba(108, 34, 189, 0.7)',  // Purple
        'rgba(61, 220, 132, 0.7)',  // Green
        'rgba(255, 123, 84, 0.7)'   // Orange
    ];
    
    // Create particles
    const particles = [];
    
    // Mouse position
    const mouse = {
        x: null,
        y: null,
        radius: mouseRadius
    };
    
    // Track mouse position
    canvas.addEventListener('mousemove', (event) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = event.clientX - rect.left;
        mouse.y = event.clientY - rect.top;
    });
    
    // Reset mouse position when mouse leaves
    canvas.addEventListener('mouseleave', () => {
        mouse.x = null;
        mouse.y = null;
    });
    
    // Particle class
    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width / window.devicePixelRatio;
            this.y = Math.random() * canvas.height / window.devicePixelRatio;
            this.velocityX = Math.random() * particleSpeed * 2 - particleSpeed;
            this.velocityY = Math.random() * particleSpeed * 2 - particleSpeed;
            this.size = Math.random() * 2 + 1;
            this.color = colors[Math.floor(Math.random() * colors.length)];
            // Add a unique wobble effect to each particle
            this.wobble = {
                speed: Math.random() * 0.02 + 0.01,
                offset: Math.random() * Math.PI * 2,
                amplitude: Math.random() * 0.5 + 0.5
            };
        }
        
        update() {
            // Wall detection with bounce
            if (this.x < 0 || this.x > canvas.width / window.devicePixelRatio) {
                this.velocityX = -this.velocityX;
            }
            
            if (this.y < 0 || this.y > canvas.height / window.devicePixelRatio) {
                this.velocityY = -this.velocityY;
            }
            
            // Mouse interaction
            if (mouse.x !== null && mouse.y !== null) {
                const dx = mouse.x - this.x;
                const dy = mouse.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < mouse.radius) {
                    // Calculate force based on distance (closer = stronger)
                    const force = (mouse.radius - distance) / mouse.radius;
                    
                    // Add wobble to make movement more organic
                    const wobbleX = Math.sin(Date.now() * this.wobble.speed + this.wobble.offset) * this.wobble.amplitude;
                    const wobbleY = Math.cos(Date.now() * this.wobble.speed + this.wobble.offset) * this.wobble.amplitude;
                    
                    // Apply the force in the direction away from mouse
                    this.velocityX += dx * force * mouseForce * 0.01 + wobbleX * 0.1;
                    this.velocityY += dy * force * mouseForce * 0.01 + wobbleY * 0.1;
                }
            }
            
            // Add gentle wobble even when not near mouse
            this.velocityX += Math.sin(Date.now() * this.wobble.speed * 0.3 + this.wobble.offset) * 0.01 * this.wobble.amplitude;
            this.velocityY += Math.cos(Date.now() * this.wobble.speed * 0.3 + this.wobble.offset) * 0.01 * this.wobble.amplitude;
            
            // Limit speed
            const speed = Math.sqrt(this.velocityX * this.velocityX + this.velocityY * this.velocityY);
            if (speed > 2) {
                this.velocityX = (this.velocityX / speed) * 2;
                this.velocityY = (this.velocityY / speed) * 2;
            }
            
            // Add some drag to slow particles
            this.velocityX *= 0.98;
            this.velocityY *= 0.98;
            
            // Update position
            this.x += this.velocityX;
            this.y += this.velocityY;
        }
        
        draw() {
            // Draw particle with pulsing effect
            const pulseScale = 1 + Math.sin(Date.now() * 0.003 + this.wobble.offset) * 0.1;
            const size = this.size * pulseScale;
            
            ctx.beginPath();
            ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.globalAlpha = dotOpacity;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }
    
    // Initialize particles
    function init() {
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
    }
    
    // Connect particles with lines
    function connect() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < maxDistance) {
                    // Make lines fade based on distance
                    const opacity = lineOpacity * (1 - distance / maxDistance);
                    
                    // Get gradient color between two particles
                    const gradient = ctx.createLinearGradient(
                        particles[i].x, particles[i].y,
                        particles[j].x, particles[j].y
                    );
                    
                    gradient.addColorStop(0, particles[i].color);
                    gradient.addColorStop(1, particles[j].color);
                    
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = gradient;
                    ctx.globalAlpha = opacity;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            }
        }
    }
    
    // Animation loop
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Update and draw particles
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();
        }
        
        // Connect particles with lines
        connect();
        
        requestAnimationFrame(animate);
    }
    
    // Start the animation
    init();
    animate();
}
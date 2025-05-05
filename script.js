document.addEventListener('DOMContentLoaded', function() {
    initNetworkBackground();
    
    const { Engine, Render, Runner, Body, Bodies, Composite, Events, Mouse, MouseConstraint, Common, Vector } = Matter;

    
    const engine = Engine.create({
        positionIterations: 12,    
        velocityIterations: 12,    
        constraintIterations: 6,   
        enableSleeping: true      
    });
    const world = engine.world;

    world.gravity.scale = 0.001;
    world.gravity.y = 1;

    
    const canvas = document.getElementById('physics-canvas');
    const canvasContainer = document.querySelector('.canvas-container');
    const canvasWrapper = document.querySelector('.canvas-wrapper');
    
    
    console.log('Canvas element:', canvas);
    console.log('Canvas container:', canvasContainer);
    console.log('Canvas wrapper:', canvasWrapper);
    
    if (!canvas || !canvasContainer) {
        console.error('Canvas or container elements not found!');
        return;
    }
    
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = canvasContainer.offsetWidth * pixelRatio;
    canvas.height = canvasContainer.offsetHeight * pixelRatio;
    canvas.style.width = `${canvasContainer.offsetWidth}px`;
    canvas.style.height = `${canvasContainer.offsetHeight}px`;

    let scrollY = 0;
    canvasWrapper.addEventListener('scroll', () => {
        scrollY = canvasWrapper.scrollTop;
        updateBoundaries();
    });

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
        isFixed: false,            // Changed to false to use requestAnimationFrame
        delta: 1000/120            // Increased from 60 FPS to 120 FPS for smoother animation
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
        
        // Create the base ground
        const ground = Bodies.rectangle(
            canvas.width / 2, 
            canvas.height - groundHeight/2 + scrollY, 
            canvas.width, 
            groundHeight, 
            {
                ...wallOptions,
                render: {
                    fillStyle: '#34A853', 
                    strokeStyle: 'rgba(255, 255, 255, 0.3)',
                    lineWidth: 2
                },
                friction: 0.3,
                frictionStatic: 0.5,
            }
        );
        
        const basePlatformOptions = {
            isStatic: true,
            chamfer: { radius: 5 },
            render: {
                fillStyle: 'rgba(66, 133, 244, 0.9)', 
                strokeStyle: 'rgba(255, 255, 255, 0.3)',
                lineWidth: 2
            },
            friction: 0.3,           
            frictionStatic: 0.5,     
            restitution: 0.2,        
            slop: 0.1,               
            collisionFilter: {       
                category: 0x0001,
                mask: 0xFFFFFFFF
            }
        };
        
        const basePlatform = Bodies.rectangle(
            canvas.width / 2,
            canvas.height - groundHeight - 30 + scrollY, 
            canvas.width - 120,
            20,
            basePlatformOptions
        );
        
        const leftSupport = Bodies.rectangle(
            canvas.width / 2 - (canvas.width - 180) / 4,
            canvas.height - groundHeight - 15 + scrollY, 
            15,
            30,
            {
                isStatic: true,
                render: {
                    fillStyle: '#EA4335', 
                    strokeStyle: 'rgba(255, 255, 255, 0.3)',
                    lineWidth: 1
                }
            }
        );
        
        const rightSupport = Bodies.rectangle(
            canvas.width / 2 + (canvas.width - 180) / 4,
            canvas.height - groundHeight - 15 + scrollY, 
            15,
            30,
            {
                isStatic: true,
                render: {
                    fillStyle: '#FBBC05', 
                    strokeStyle: 'rgba(255, 255, 255, 0.3)',
                    lineWidth: 1
                }
            }
        );
        
        const bottomFloor = Bodies.rectangle(
            canvas.width / 2,
            canvasContainer.offsetHeight - groundHeight/2,
            canvas.width * 2, 
            groundHeight * 2, 
            {
                isStatic: true,
                render: {
                    fillStyle: '#34A853', 
                    strokeStyle: 'rgba(255, 255, 255, 0.3)',
                    lineWidth: 1
                },
                friction: 0.5,
                frictionStatic: 0.7,
            }
        );
        
        // Left wall
        const leftWall = Bodies.rectangle(
            wallWidth/2, 
            canvas.height / 2 + scrollY / 2, 
            wallWidth, 
            canvas.height + scrollY, 
            wallOptions
        );
        
       
        
        const rightWallWidth = canvas.width * 0.3;
        const rightWall = Bodies.rectangle(
            canvas.width - rightWallWidth/2, 
            canvas.height / 2 + scrollY / 2, 
            rightWallWidth, 
            canvas.height * 2, 
            {
                isStatic: true,
                chamfer: { radius: 5 },
                render: {
                    fillStyle: 'rgba(66, 133, 244, 0.8)',
                    strokeStyle: 'rgba(255, 255, 255, 0.3)',
                    lineWidth: 2
                }
            }
        );
        
        // Additional right edge barrier to absolutely prevent shapes from passing the visible right edge
        const rightEdgeBarrier = Bodies.rectangle(
            canvas.width + wallWidth/2,
            canvas.height / 2 + scrollY / 2,
            wallWidth * 2,
            canvas.height * 2,
            {
                isStatic: true,
                render: {
                    visible: false 
                },
                friction: 1,
                frictionStatic: 1,
                restitution: 0.1
            }
        );
        
        
        const decorElement1 = Bodies.rectangle(
            canvas.width - rightWallWidth/2,
            canvas.height * 0.25 + scrollY,
            rightWallWidth * 0.7,
            30,
            {
                isStatic: true,
                chamfer: { radius: 15 },
                render: {
                    fillStyle: '#EA4335',
                    strokeStyle: 'rgba(255, 255, 255, 0.3)',
                    lineWidth: 1
                }
            }
        );
        
        const decorElement2 = Bodies.rectangle(
            canvas.width - rightWallWidth/2,
            canvas.height * 0.5 + scrollY,
            rightWallWidth * 0.5,
            30,
            {
                isStatic: true,
                chamfer: { radius: 15 },
                render: {
                    fillStyle: '#FBBC05',
                    strokeStyle: 'rgba(255, 255, 255, 0.3)',
                    lineWidth: 1
                }
            }
        );
        
        const decorElement3 = Bodies.rectangle(
            canvas.width - rightWallWidth/2,
            canvas.height * 0.75 + scrollY,
            rightWallWidth * 0.7,
            30,
            {
                isStatic: true,
                chamfer: { radius: 15 },
                render: {
                    fillStyle: '#34A853',
                    strokeStyle: 'rgba(255, 255, 255, 0.3)',
                    lineWidth: 1
                }
            }
        );
        
        const ceiling = Bodies.rectangle(
            canvas.width / 2, 
            wallWidth/2 + scrollY, 
            canvas.width, 
            wallWidth, 
            wallOptions
        );
        
        boundaries = [
            ground, basePlatform, leftSupport, rightSupport, 
            leftWall, rightWall, rightEdgeBarrier, ceiling, bottomFloor, 
            decorElement1, decorElement2, decorElement3
        ];
        Composite.add(world, boundaries);
        
        const rampOptions = {
            isStatic: true,
            chamfer: { radius: 2 },
            render: {
                fillStyle: 'rgba(66, 133, 244, 0.8)', 
                strokeStyle: 'rgba(255, 255, 255, 0.3)',
                lineWidth: 1
            },
            friction: 0.1,
            restitution: 0.1
        };
        
        const leftRamp = Bodies.rectangle(
            basePlatform.position.x - (canvas.width - 120) / 2 - 30,
            basePlatform.position.y + 15,
            80,
            10,
            rampOptions
        );
        
        Body.rotate(leftRamp, Math.PI / 8);
        
        const rightRamp = Bodies.rectangle(
            basePlatform.position.x + (canvas.width - 120) / 2 + 30,
            basePlatform.position.y + 15,
            80,
            10,
            rampOptions
        );
        
        Body.rotate(rightRamp, -Math.PI / 8);
        
        boundaries.push(leftRamp, rightRamp);
        Composite.add(world, [leftRamp, rightRamp]);
    }

    function createBody(x, y, type) {
        const googleColors = [
            '#4285F4', 
            '#EA4335', 
            '#FBBC05', 
            '#34A853'  
        ];
        
        const color = googleColors[Math.floor(Math.random() * googleColors.length)];
        
        const options = {
            restitution: 0.3,         
            friction: 0.15,           
            frictionAir: 0.002,       
            frictionStatic: 0.3,      
            density: 0.0025,          
            chamfer: { radius: 2 },   
            render: {
                fillStyle: color,
                strokeStyle: 'rgba(255, 255, 255, 0.3)',
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
        
        Body.setVelocity(body, { 
            x: Common.random(-1, 1) * 2,
            y: Common.random(-0.1, 0.1)
        });
        
        activeBodies.push(body);
        Composite.add(world, body);
        
        createRippleEffect(x, y);
        
        return body;
    }

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
            rotationSpeed: (Math.random() - 0.5) * 0.1, 
            lifespan: 60,
            maxLifespan: 60,
            gravity: 0.02,
            drag: 0.98
        };
    }

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

    function renderExplosionParticles(render) {
        const context = render.context;
        
        context.globalCompositeOperation = 'lighter';
        
        explosionParticles.forEach(particle => {
            context.save();
            context.globalAlpha = particle.alpha;
            context.translate(particle.x, particle.y);
            context.rotate(particle.rotation);
            
            const shapePicker = Math.floor(particle.size) % 3;
            
            const glow = context.createRadialGradient(0, 0, 0, 0, 0, particle.size * 1.2);
            glow.addColorStop(0, particle.color);
            glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            switch(shapePicker) {
                case 0: 
                    context.beginPath();
                    context.arc(0, 0, particle.size, 0, Math.PI * 2);
                    context.fillStyle = glow;
                    context.fill();
                    break;
                    
                case 1: 
                    context.fillStyle = glow;
                    context.fillRect(-particle.size/2, -particle.size/2, particle.size, particle.size);
                    break;
                    
                case 2: 
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

    function updateExplosionParticles() {
        for (let i = explosionParticles.length - 1; i >= 0; i--) {
            const particle = explosionParticles[i];
            
            // Use smoother interpolation for particle movement
            particle.x += particle.velocity.x;
            particle.y += particle.velocity.y;
            
            // Add smoother gravity effect
            particle.velocity.y += particle.gravity;
            
            // Enhanced drag for smoother deceleration
            particle.velocity.x *= particle.drag;
            particle.velocity.y *= particle.drag;
            
            // Smoother rotation
            particle.rotation += particle.rotationSpeed;
            
            // More gradual size reduction for smoother scaling
            particle.size *= 0.995; // Changed from 0.99 for smoother scaling
            
            // Enhanced quadratic easing for alpha transition
            const progress = particle.lifespan / particle.maxLifespan;
            particle.alpha = progress * progress; // Quadratic easing
            
            particle.lifespan--;
            
            if (particle.lifespan <= 0 || particle.size < 0.5) {
                explosionParticles.splice(i, 1);
            }
        }
        
        for (let i = trailParticles.length - 1; i >= 0; i--) {
            const particle = trailParticles[i];
            particle.lifespan--;
            
            if (particle.lifespan <= 0) {
                trailParticles.splice(i, 1);
            }
        }
        
        if (Math.random() < 0.3) { 
            activeBodies.forEach(body => {
                if (Vector.magnitude(body.velocity) > 1) {
                    const speed = Vector.magnitude(body.velocity);
                    
                    if (speed > 2) { 
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

    function createExplosion(x, y, intensity = 1) {
        const particleCount = Math.floor(25 * intensity);
        const baseSize = 3 + (intensity * 2);
        const baseSpeed = 1 + (intensity * 1.5);
        
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 10 * intensity;
            const size = baseSize + Math.random() * 6;
            
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
            
            const lifespanVariation = 0.8 + Math.random() * 0.4;
            particle.lifespan = Math.floor(60 * lifespanVariation);
            particle.maxLifespan = particle.lifespan;
            
            explosionParticles.push(particle);
        }
        
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
            
            const sparkLifespan = 20 + Math.floor(Math.random() * 20);
            spark.maxLifespan = sparkLifespan;
            spark.lifespan = sparkLifespan;
            spark.gravity = 0.01; 
            
            explosionParticles.push(spark);
        }
        
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

    function handleCollision(event) {
        const pairs = event.pairs;
        
        for (let i = 0; i < pairs.length; i++) {
            const bodyA = pairs[i].bodyA;
            const bodyB = pairs[i].bodyB;
            
            const relativeVelocity = {
                x: bodyA.velocity.x - bodyB.velocity.x,
                y: bodyA.velocity.y - bodyB.velocity.y
            };
            const collisionSpeed = Math.sqrt(relativeVelocity.x * relativeVelocity.x + relativeVelocity.y * relativeVelocity.y);
            const impactThreshold = 2; 
            
            if (collisionSpeed < impactThreshold || (boundaries.includes(bodyA) && boundaries.includes(bodyB))) {
                continue;
            }
            
            const impactForce = Math.min(1, collisionSpeed / 10);
            
            const midX = (bodyA.position.x + bodyB.position.x) / 2;
            const midY = (bodyA.position.y + bodyB.position.y) / 2;
            
            switch(currentEffect) {
                case 'bounce':
                    if (!boundaries.includes(bodyA)) {
                        const velocityA = Vector.mult(Vector.normalise(bodyA.velocity), bodyA.speed * (1 + impactForce * 0.3));
                        Body.setVelocity(bodyA, velocityA);
                    }
                    if (!boundaries.includes(bodyB)) {
                        const velocityB = Vector.mult(Vector.normalise(bodyB.velocity), bodyB.speed * (1 + impactForce * 0.3));
                        Body.setVelocity(bodyB, velocityB);
                    }
                    
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
                    if (!boundaries.includes(bodyA) && !boundaries.includes(bodyB)) {
                        const intensity = 0.5 + impactForce * 2.5;
                        createExplosion(midX, midY, intensity);
                        
                        const particleCount = Math.floor(impactForce * 4) + 1;
                        for (let j = 0; j < particleCount; j++) {
                            const particle = Bodies.circle(
                                midX + Common.random(-5, 5),
                                midY + Common.random(-5, 5),
                                Common.random(2, 4 + impactForce * 2),
                                {
                                    restitution: 0.3,       // Reduced from 0.8 for less bounce
                                    friction: 0.15,         // Increased from 0.05
                                    frictionAir: 0.008,     // Increased from 0.005
                                    render: {
                                        fillStyle: explosionColors[Math.floor(Math.random() * explosionColors.length)],
                                        opacity: 0.8
                                    }
                                }
                            );
                            
                            const forceMagnitude = 0.01 + (impactForce * 0.03);
                            const angle = Math.random() * Math.PI * 2;
                            Body.applyForce(particle, particle.position, {
                                x: forceMagnitude * Math.cos(angle),
                                y: forceMagnitude * Math.sin(angle)
                            });
                            
                            activeBodies.push(particle);
                            Composite.add(world, particle);
                            
                            const removeDelay = 1500 + Math.random() * 1000;
                            setTimeout(() => {
                                if (activeBodies.includes(particle)) {
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
                    if (!boundaries.includes(bodyA) && !boundaries.includes(bodyB)) {
                        const baseForce = 0.0005;
                        const forceMagnitude = baseForce * (1 + impactForce);
                        
                        const direction = Vector.sub(bodyB.position, bodyA.position);
                        const distance = Vector.magnitude(direction);
                        
                        if (distance > 0) {
                            const normalizedDirection = Vector.normalise(direction);
                            
                            Body.applyForce(bodyA, bodyA.position, 
                                Vector.mult(normalizedDirection, forceMagnitude * bodyA.mass));
                            
                            Body.applyForce(bodyB, bodyB.position, 
                                Vector.mult(normalizedDirection, -forceMagnitude * bodyB.mass));
                            
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
                    if (!boundaries.includes(bodyA) || !boundaries.includes(bodyB)) {
                        const startAngle = Math.atan2(world.gravity.y, world.gravity.x);
                        const angleChange = (Math.random() - 0.5) * Math.PI * impactForce * 2;
                        const newAngle = startAngle + angleChange;
                        
                        const oldGravityX = world.gravity.x;
                        const oldGravityY = world.gravity.y;
                        
                        const targetGravityX = Math.sin(newAngle) * 0.001;
                        const targetGravityY = Math.cos(newAngle) * 0.001;
                        
                        const transitionSteps = 20;
                        const transitionDelay = 50;
                        
                        for (let step = 0; step <= transitionSteps; step++) {
                            setTimeout(() => {
                                const progress = step / transitionSteps;
                                const easing = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                                
                                world.gravity.x = oldGravityX + (targetGravityX - oldGravityX) * easing;
                                world.gravity.y = oldGravityY + (targetGravityY - oldGravityY) * easing;
                            }, step * transitionDelay);
                        }
                        
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
                        
                        const resetDelay = 1500 + impactForce * 1000;
                        setTimeout(() => {
                            const finalGravityX = world.gravity.x;
                            const finalGravityY = world.gravity.y;
                            
                            for (let step = 0; step <= transitionSteps; step++) {
                                setTimeout(() => {
                                    const progress = step / transitionSteps;
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

    Events.on(render, 'afterRender', function() {
        updateExplosionParticles();
        renderExplosionParticles(render);
    });

    Events.on(engine, 'collisionStart', handleCollision);

    const mouse = Mouse.create(render.canvas);
    const mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: {
            stiffness: 0.1,  
            damping: 0.1,    
            render: {
                visible: false
            }
        }
    });

    mouse.pixelRatio = pixelRatio;

    Composite.add(world, mouseConstraint);
    render.mouse = mouse;

    Events.on(mouseConstraint, 'startdrag', function(event) {
        const body = event.body;
        createRippleEffect(body.position.x, body.position.y);
    });

    document.querySelectorAll('.effect-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.effect-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            const newEffect = button.getAttribute('data-effect');
            
            if (newEffect !== currentEffect) {
                currentEffect = newEffect;
                
                const x = canvas.width / (2 * pixelRatio);
                const y = canvas.height / (2 * pixelRatio);
                
                let effectColor;
                switch(currentEffect) {
                    case 'bounce': effectColor = '#3ddc84'; break;
                    case 'explode': effectColor = '#ff7b54'; break;
                    case 'stick': effectColor = '#6c22bd'; break;
                    case 'gravity': effectColor = '#ffb26b'; break;
                    default: effectColor = '#ffffff';
                }
                
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

    document.getElementById('add-circle').addEventListener('click', () => {
        createBody(canvas.width / (2 * pixelRatio), 50, 'circle');
    });

    document.getElementById('add-square').addEventListener('click', () => {
        createBody(canvas.width / (2 * pixelRatio), 50, 'square');
    });

    document.getElementById('add-polygon').addEventListener('click', () => {
        createBody(canvas.width / (2 * pixelRatio), 50, 'polygon');
    });

    // Smoother reset animation
    document.getElementById('reset-scene').addEventListener('click', () => {
        const removalDelay = 15; // Reduced from 20 for faster animation
        
        activeBodies.forEach((body, index) => {
            setTimeout(() => {
                createExplosion(body.position.x, body.position.y, 0.5);
                
                // Add fade-out effect before removal
                const fadeSteps = 10;
                for (let i = 0; i < fadeSteps; i++) {
                    setTimeout(() => {
                        if (body.render && typeof body.render.opacity !== 'undefined') {
                            body.render.opacity = 1 - (i / fadeSteps);
                        }
                    }, i * 20);
                }
                
                setTimeout(() => {
                    Composite.remove(world, body);
                    
                    if (index === activeBodies.length - 1) {
                        activeBodies = [];
                    }
                }, fadeSteps * 20);
                
            }, index * removalDelay);
        });
        
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

    // Enhanced animation transitions for UI effects
    document.getElementById('toggle-gravity').addEventListener('click', () => {
        const targetY = world.gravity.y === 1 ? 0 : 1;
        const currentY = world.gravity.y;
        const steps = 30; // Increased from 15 for smoother transition
        
        for (let i = 0; i <= steps; i++) {
            setTimeout(() => {
                const progress = i / steps;
                // Cubic easing for smoother gravity transition
                const easing = progress < 0.5 
                    ? 4 * progress * progress * progress 
                    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
                world.gravity.y = currentY + (targetY - currentY) * easing;
            }, i * 15); // Reduced from 20ms to 15ms for faster response
        }
        
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

    window.addEventListener('resize', () => {
        boundaries.forEach(boundary => {
            Composite.remove(world, boundary);
        });
        
        canvas.width = canvasContainer.offsetWidth * pixelRatio;
        canvas.height = canvasContainer.offsetHeight * pixelRatio;
        canvas.style.width = `${canvasContainer.offsetWidth}px`;
        canvas.style.height = `${canvasContainer.offsetHeight}px`;
        
        render.options.width = canvas.width;
        render.options.height = canvas.height;
        
        createBoundaries();
    });

    // Enhanced click ripple effect
    canvas.addEventListener('click', (event) => {
        if (mouseConstraint.body) {
            return;
        }
        
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) * pixelRatio;
        const y = (event.clientY - rect.top) * pixelRatio;
        
        const shapeTypes = ['circle', 'square', 'polygon'];
        const randomType = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];
        
        createBody(x, y, randomType);
        
        // Create more ripples with staggered timing for smoother effect
        for (let i = 0; i < 12; i++) { // Increased from 8 to 12
            setTimeout(() => {
                createRippleEffect(x, y);
            }, i * 25); // Reduced from 30ms to 25ms for faster animation
        }
    });

    createBoundaries();

    console.log("Creating initial shapes...");
    setTimeout(() => {
        for (let i = 0; i < 5; i++) {
            const x = Common.random(100, canvas.width / pixelRatio - 200); // Adjusted to avoid right edge
            const y = Common.random(50, 100);
            const type = ['circle', 'square', 'polygon'][Math.floor(Math.random() * 3)];
            console.log(`Creating shape ${i}: ${type} at (${x}, ${y})`);
            createBody(x, y, type);
        }
    }, 500); // Added delay to ensure canvas is ready

    // Debug helper
    window.debugPhysics = function() {
        console.log("World bodies:", world.bodies.length);
        console.log("Active bodies:", activeBodies.length);
        console.log("Canvas dimensions:", canvas.width, canvas.height);
        console.log("Gravity:", world.gravity);
        
        // Force create a shape at center
        createBody(canvas.width / (2 * pixelRatio), 100, 'circle');
    };
});

function initNetworkBackground() {
    const canvas = document.getElementById('network-background');
    const ctx = canvas.getContext('2d');
    const container = document.querySelector('.canvas-container');
    
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
    
    const particleCount = 120;   
    const maxDistance = 180;     
    const lineOpacity = 0.25;    
    const dotOpacity = 0.6;      
    const particleSpeed = 0.4;   
    const mouseRadius = 200;     
    const mouseForce = 3.5;      
    
    const colors = [
        'rgba(120, 60, 220, 0.85)',  
        'rgba(70, 240, 140, 0.85)',  
        'rgba(255, 140, 90, 0.85)',  
        'rgba(65, 200, 255, 0.85)'   
    ];
    
    const particles = [];
    
    const mouse = {
        x: null,
        y: null,
        radius: mouseRadius,
        active: false            
    };
    
    canvas.addEventListener('click', (event) => {
        createPulseEffect(event.clientX - canvas.getBoundingClientRect().left, 
                         event.clientY - canvas.getBoundingClientRect().top);
    });
    
    canvas.addEventListener('mousemove', (event) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = event.clientX - rect.left;
        mouse.y = event.clientY - rect.top;
        
        if (!mouse.active) {
            mouse.active = true;
            let startRadius = 50;
            const expandInterval = setInterval(() => {
                startRadius += 10;
                if (startRadius >= mouse.radius) {
                    clearInterval(expandInterval);
                }
            }, 20);
        }
    });
    
    canvas.addEventListener('mouseout', () => {
        mouse.x = null;
        mouse.y = null;
        mouse.active = false;
    });
    
    function createPulseEffect(x, y) {
        const pulseCount = 3;
        
        for (let i = 0; i < pulseCount; i++) {
            setTimeout(() => {
                const pulse = {
                    x: x,
                    y: y,
                    size: 0,
                    maxSize: 200 + (i * 50),
                    opacity: 0.7,
                    color: colors[Math.floor(Math.random() * colors.length)]
                };
                
                const pulseInterval = setInterval(() => {
                    pulse.size += 5;
                    pulse.opacity -= 0.01;
                    
                    ctx.beginPath();
                    ctx.arc(pulse.x, pulse.y, pulse.size, 0, Math.PI * 2);
                    ctx.strokeStyle = pulse.color;
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = pulse.opacity;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                    
                    if (pulse.size >= pulse.maxSize || pulse.opacity <= 0) {
                        clearInterval(pulseInterval);
                    }
                }, 20);
            }, i * 200);
        }
        
        for (let i = 0; i < 8; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 20;
            const newParticle = new Particle();
            
            newParticle.x = x + Math.cos(angle) * distance;
            newParticle.y = y + Math.sin(angle) * distance;
            newParticle.size = Math.random() * 4 + 2; 
            
            newParticle.velocityX = Math.cos(angle) * (Math.random() * 2 + 1);
            newParticle.velocityY = Math.sin(angle) * (Math.random() * 2 + 1);
            
            particles.push(newParticle);
        }
    }
    
    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width / window.devicePixelRatio;
            this.y = Math.random() * canvas.height / window.devicePixelRatio;
            this.velocityX = Math.random() * particleSpeed * 2 - particleSpeed;
            this.velocityY = Math.random() * particleSpeed * 2 - particleSpeed;
            this.size = Math.random() * 3 + 1.5; 
            this.baseSize = this.size; 
            this.color = colors[Math.floor(Math.random() * colors.length)];
            this.targetX = null; 
            this.targetY = null;
            this.wobble = {
                speed: Math.random() * 0.02 + 0.01,
                offset: Math.random() * Math.PI * 2,
                amplitude: Math.random() * 0.7 + 0.6 
            };
            this.glow = Math.random() > 0.7; 
            this.glowIntensity = Math.random() * 0.5 + 0.5;
        }
        
        update() {
            if (this.x < 0 || this.x > canvas.width / window.devicePixelRatio) {
                this.velocityX = -this.velocityX;
            }
            
            if (this.y < 0 || this.y > canvas.height / window.devicePixelRatio) {
                this.velocityY = -this.velocityY;
            }
            
            if (mouse.x !== null && mouse.y !== null) {
                const dx = mouse.x - this.x;
                const dy = mouse.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < mouse.radius) {
                    const force = (mouse.radius - distance) / mouse.radius;
                    
                    const wobbleX = Math.sin(Date.now() * this.wobble.speed + this.wobble.offset) * this.wobble.amplitude;
                    const wobbleY = Math.cos(Date.now() * this.wobble.speed + this.wobble.offset) * this.wobble.amplitude;
                    
                    this.velocityX += -dx * force * mouseForce * 0.015 + wobbleX * 0.15;
                    this.velocityY += -dy * force * mouseForce * 0.015 + wobbleY * 0.15;
                    
                    this.size = this.baseSize * (1 + force * 0.5);
                    
                    if (Math.random() > 0.95) {
                        this.color = colors[Math.floor(Math.random() * colors.length)];
                    }
                } else {
                    if (this.size > this.baseSize) {
                        this.size = this.baseSize + (this.size - this.baseSize) * 0.9;
                    }
                }
            } else {
                if (this.size > this.baseSize) {
                    this.size = this.baseSize + (this.size - this.baseSize) * 0.9;
                }
            }
            
            this.velocityX += Math.sin(Date.now() * this.wobble.speed * 0.3 + this.wobble.offset) * 0.015 * this.wobble.amplitude;
            this.velocityY += Math.cos(Date.now() * this.wobble.speed * 0.3 + this.wobble.offset) * 0.015 * this.wobble.amplitude;
            
            const speed = Math.sqrt(this.velocityX * this.velocityX + this.velocityY * this.velocityY);
            if (speed > 2.5) { 
                this.velocityX = (this.velocityX / speed) * 2.5;
                this.velocityY = (this.velocityY / speed) * 2.5;
            }
            
            this.velocityX *= 0.98;
            this.velocityY *= 0.98;
            
            this.x += this.velocityX;
            this.y += this.velocityY;
        }
        
        draw() {
            const pulseScale = 1 + Math.sin(Date.now() * 0.004 + this.wobble.offset) * 0.15; 
            const size = this.size * pulseScale;
            
            if (this.glow) {
                const glow = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, size * 2.5);
                glow.addColorStop(0, this.color);
                glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
                
                ctx.beginPath();
                ctx.arc(this.x, this.y, size * 2.5, 0, Math.PI * 2);
                ctx.fillStyle = glow;
                ctx.globalAlpha = 0.2 * this.glowIntensity * pulseScale;
                ctx.fill();
                ctx.globalAlpha = 1;
            }
            
            ctx.beginPath();
            ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.globalAlpha = dotOpacity;
            ctx.fill();
            
            if (Math.random() > 0.7) {
                ctx.beginPath();
                ctx.arc(this.x, this.y, size * 0.4, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.fill();
            }
            
            ctx.globalAlpha = 1;
        }
    }
    
    function init() {
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
    }
    
    function connect() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < maxDistance) {
                    const opacity = lineOpacity * Math.pow((1 - distance / maxDistance), 2);
                    
                    const gradient = ctx.createLinearGradient(
                        particles[i].x, particles[i].y,
                        particles[j].x, particles[j].y
                    );
                    
                    gradient.addColorStop(0, particles[i].color);
                    gradient.addColorStop(1, particles[j].color);
                    
                    const lineWidth = Math.max(0.5, 1.5 * (1 - distance / maxDistance));
                    
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = gradient;
                    ctx.globalAlpha = opacity;
                    ctx.lineWidth = lineWidth;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                    
                    if (mouse.x !== null && mouse.y !== null) {
                        const midX = (particles[i].x + particles[j].x) / 2;
                        const midY = (particles[i].y + particles[j].y) / 2;
                        const mouseDistance = Math.sqrt(
                            Math.pow(midX - mouse.x, 2) + 
                            Math.pow(midY - mouse.y, 2)
                        );
                        
                        if (mouseDistance < mouse.radius * 0.8) {
                            const glowOpacity = 0.1 * (1 - mouseDistance / (mouse.radius * 0.8));
                            ctx.beginPath();
                            ctx.moveTo(particles[i].x, particles[i].y);
                            ctx.lineTo(particles[j].x, particles[j].y);
                            ctx.strokeStyle = 'rgba(255, 255, 255, ' + glowOpacity + ')';
                            ctx.lineWidth = lineWidth + 1;
                            ctx.stroke();
                        }
                    }
                }
            }
        }
    }
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();
        }
        
        connect();
        
        while (particles.length > particleCount + 20) {
            particles.shift();
        }
        
        requestAnimationFrame(animate);
    }
    
    init();
    animate();
}

function updateBoundaries() {
    boundaries.forEach(boundary => {
        Composite.remove(world, boundary);
    });
    boundaries = [];
    
    createBoundaries();
}
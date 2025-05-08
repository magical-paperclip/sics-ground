document.addEventListener('DOMContentLoaded', function() {
    // Initialize network background
    const networkCanvas = document.getElementById('network-background');
    const ctx = networkCanvas.getContext('2d');
    
    // Set canvas size
    function resizeCanvas() {
        networkCanvas.width = window.innerWidth;
        networkCanvas.height = window.innerHeight;
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Particle system
    const particles = [];
    const particleCount = 30; // Reduced number of particles
    const particleColor = 'rgba(255, 107, 107, 0.1)'; // Cute pink color
    
    class Particle {
        constructor() {
            this.reset();
        }
        
        reset() {
            this.x = Math.random() * networkCanvas.width;
            this.y = Math.random() * networkCanvas.height;
            this.size = Math.random() * 2 + 1; // Smaller particles
            this.speedX = Math.random() * 0.5 - 0.25; // Slower movement
            this.speedY = Math.random() * 0.5 - 0.25;
        }
        
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            
            if (this.x < 0 || this.x > networkCanvas.width) this.speedX *= -1;
            if (this.y < 0 || this.y > networkCanvas.height) this.speedY *= -1;
        }
        
        draw() {
            ctx.fillStyle = particleColor;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
    
    // Animation loop
    function animate() {
        ctx.clearRect(0, 0, networkCanvas.width, networkCanvas.height);
        
        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });
        
        // Draw connections
        particles.forEach((p1, i) => {
            particles.slice(i + 1).forEach(p2 => {
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 100) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(0, 255, 0, ${0.05 * (1 - distance/100)})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
            });
        });
        
        requestAnimationFrame(animate);
    }
    
    animate();

    // Physics engine setup
    const { Engine, Render, Runner, Body, Bodies, Composite, Events, Mouse, MouseConstraint, Common, Vector } = Matter;

    const engine = Engine.create({
        positionIterations: 8,
        velocityIterations: 6,
        constraintIterations: 4,
        enableSleeping: false
    });
    
    const world = engine.world;
    world.gravity.scale = 0.001;
    world.gravity.y = 0.98; // More realistic gravity

    const canvas = document.getElementById('physics-canvas');
    const canvasContainer = document.querySelector('.canvas-container');
    const canvasWrapper = document.querySelector('.canvas-wrapper');
    
    if (!canvas || !canvasContainer) {
        console.error('Canvas or container elements not found!');
        return;
    }
    
    // Set canvas dimensions
    const CANVAS_WIDTH = window.innerWidth - 320; // Adjusted for new sidebar width
    const CANVAS_HEIGHT = window.innerHeight;
    const SCROLL_HEIGHT = CANVAS_HEIGHT; // Remove scrolling, make it fit viewport
    const CONTAINER_HEIGHT = CANVAS_HEIGHT;
    
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = CANVAS_WIDTH * pixelRatio;
    canvas.height = SCROLL_HEIGHT * pixelRatio;
    canvas.style.width = `${CANVAS_WIDTH}px`;
    canvas.style.height = `${SCROLL_HEIGHT}px`;
    
    canvasContainer.style.width = `${CANVAS_WIDTH}px`;
    canvasContainer.style.height = `${CONTAINER_HEIGHT}px`;
    canvasWrapper.style.width = `${CANVAS_WIDTH}px`;
    canvasWrapper.style.height = `${CONTAINER_HEIGHT}px`;
    canvasWrapper.style.overflow = 'hidden'; // Remove scrolling

    // Physics controls
    const gravitySlider = document.getElementById('gravity-slider');
    const frictionSlider = document.getElementById('friction-slider');
    const restitutionSlider = document.getElementById('restitution-slider');

    gravitySlider.addEventListener('input', (e) => {
        world.gravity.y = parseFloat(e.target.value);
    });

    frictionSlider.addEventListener('input', (e) => {
        const friction = parseFloat(e.target.value);
        activeBodies.forEach(body => {
            body.friction = friction;
            body.frictionStatic = friction * 2;
        });
    });

    restitutionSlider.addEventListener('input', (e) => {
        const restitution = parseFloat(e.target.value);
        activeBodies.forEach(body => {
            body.restitution = restitution;
        });
    });

    let scrollY = 0;
    canvasWrapper.addEventListener('scroll', () => {
        scrollY = canvasWrapper.scrollTop;
        updateBoundaries();
    });

    const render = Render.create({
        canvas: canvas,
        engine: engine,
        options: {
            width: CANVAS_WIDTH * pixelRatio,
            height: SCROLL_HEIGHT * pixelRatio,
            wireframes: false,
            background: 'transparent',
            showAngleIndicator: false,
            pixelRatio: pixelRatio,
            hasBounds: true
        }
    });

    const runner = Runner.create({
        isFixed: false,
        delta: 1000/120
    });
    
    Runner.run(runner, engine);
    Render.run(render);

    let activeBodies = [];
    let boundaries = [];
    let explosionParticles = [];
    let trailParticles = [];
    let currentEffect = 'bounce';
    let isEffectActive = false;
    const colors = ['#00ff00', '#00ffff'];
    const explosionColors = ['#ff7b54', '#ffb26b', '#ffd56b', '#939597', '#6c22bd'];

    function createDecorativeElements() {
        // Removed all decorative elements
    }

    function createBoundaries() {
        const wallOptions = { 
            isStatic: true,
            render: { 
                visible: false
            }
        };
        
        const wallWidth = 20;
        
        // Create left wall
        const leftWall = Bodies.rectangle(
            wallWidth/2,
            CANVAS_HEIGHT/2,
            wallWidth,
            CANVAS_HEIGHT,
            wallOptions
        );
        
        // Create right wall
        const rightWall = Bodies.rectangle(
            CANVAS_WIDTH - wallWidth/2,
            CANVAS_HEIGHT/2,
            wallWidth,
            CANVAS_HEIGHT,
            wallOptions
        );
        
        // Create ceiling
        const ceiling = Bodies.rectangle(
            CANVAS_WIDTH/2,
            wallWidth/2,
            CANVAS_WIDTH,
            wallWidth,
            wallOptions
        );
        
        // Create ground
        const ground = Bodies.rectangle(
            CANVAS_WIDTH/2,
            CANVAS_HEIGHT - wallWidth/2,
            CANVAS_WIDTH,
            wallWidth,
            wallOptions
        );
        
        boundaries = [leftWall, rightWall, ceiling, ground];
        Composite.add(world, boundaries);
    }

    function createBody(x, y, type) {
        const colors = [
            '#4285F4', // Google Blue
            '#EA4335', // Google Red
            '#FBBC05', // Google Yellow
            '#34A853'  // Google Green
        ];
        
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        const options = {
            restitution: 0.4, // Less bouncy
            friction: 0.3,    // More friction
            frictionAir: 0.001,
            frictionStatic: 0.5,
            density: 0.002,   // Slightly heavier
            render: {
                fillStyle: color,
                strokeStyle: 'rgba(255, 255, 255, 0.2)',
                lineWidth: 1
            }
        };
        
        let body;
        
        // Adjust size based on pixel ratio to prevent stretching
        const baseSize = Common.random(15, 30);
        const adjustedSize = baseSize / pixelRatio;
        
        switch(type) {
            case 'circle':
                body = Bodies.circle(x, y, adjustedSize, options);
                break;
            case 'square':
                body = Bodies.rectangle(x, y, adjustedSize * 2, adjustedSize * 2, options);
                break;
            case 'polygon':
                body = Bodies.polygon(x, y, Common.random(3, 6), adjustedSize, options);
                break;
            default:
                body = Bodies.circle(x, y, adjustedSize, options);
        }
        
        // Set initial velocity with slight randomness
        Body.setVelocity(body, { 
            x: Common.random(-0.5, 0.5),
            y: Common.random(-0.5, 0.5)
        });
        
        activeBodies.push(body);
        Composite.add(world, body);
        
        createRippleEffect(x, y);
        
        return body;
    }

    function createRippleEffect(x, y) {
        // Create a single burst of particles
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
            
            particle.x += particle.velocity.x;
            particle.y += particle.velocity.y;
            particle.velocity.y += particle.gravity;
            particle.velocity.x *= particle.drag;
            particle.velocity.y *= particle.drag;
            particle.rotation += particle.rotationSpeed;
            particle.size *= 0.995;
            
            const progress = particle.lifespan / particle.maxLifespan;
            particle.alpha = progress * progress;
            
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
                        }
                    }
                    break;
                    
                case 'gravity':
                    if (!boundaries.includes(bodyA) || !boundaries.includes(bodyB)) {
                        const startAngle = Math.atan2(world.gravity.y, world.gravity.x);
                        const angleChange = (Math.random() - 0.5) * Math.PI * impactForce * 2;
                        const newAngle = startAngle + angleChange;
                        
                        world.gravity.x = Math.sin(newAngle) * 0.001;
                        world.gravity.y = Math.cos(newAngle) * 0.001;
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

    // Remove old effect button handlers
    document.querySelectorAll('.effect-btn').forEach(button => {
        button.removeEventListener('click', () => {});
    });

    // Add keyboard controls
    document.addEventListener('keydown', (event) => {
        switch(event.key.toLowerCase()) {
            case 'b':
                currentEffect = 'bounce';
                isEffectActive = true;
                break;
            case 'e':
                currentEffect = 'explode';
                isEffectActive = true;
                break;
            case 's':
                currentEffect = 'stick';
                isEffectActive = true;
                break;
            case 'g':
                currentEffect = 'gravity';
                isEffectActive = true;
                break;
        }
    });

    document.addEventListener('keyup', (event) => {
        if (['b', 'e', 's', 'g'].includes(event.key.toLowerCase())) {
            isEffectActive = false;
        }
    });

    // Add mouse move effect handler
    Events.on(mouseConstraint, 'mousemove', function(event) {
        if (isEffectActive) {
            const mouseX = mouse.position.x;
            const mouseY = mouse.position.y;
            
            let effectColor;
            switch(currentEffect) {
                case 'bounce': effectColor = '#3ddc84'; break;
                case 'explode': effectColor = '#ff7b54'; break;
                case 'stick': effectColor = '#6c22bd'; break;
                case 'gravity': effectColor = '#ffb26b'; break;
                default: effectColor = '#ffffff';
            }
            
            // Create effect particles at mouse position
            for (let i = 0; i < 12; i++) {
                const angle = (i / 12) * Math.PI * 2;
                const modeParticle = createExplosionParticle(
                    mouseX, mouseY,
                    effectColor,
                    4,
                    2,
                    angle
                );
                
                modeParticle.maxLifespan = 20;
                modeParticle.lifespan = 20;
                modeParticle.gravity = 0;
                
                explosionParticles.push(modeParticle);
            }
            
            // Apply effect to nearby bodies
            activeBodies.forEach(body => {
                if (!boundaries.includes(body)) {
                    const dx = body.position.x - mouseX;
                    const dy = body.position.y - mouseY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < 100) {
                        switch(currentEffect) {
                            case 'bounce':
                                const velocity = Vector.normalise({ x: dx, y: dy });
                                Body.setVelocity(body, Vector.mult(velocity, 5));
                                break;
                                
                            case 'explode':
                                const force = Vector.normalise({ x: dx, y: dy });
                                Body.applyForce(body, body.position, Vector.mult(force, 0.01));
                                break;
                                
                            case 'stick':
                                const stickForce = Vector.normalise({ x: -dx, y: -dy });
                                Body.applyForce(body, body.position, Vector.mult(stickForce, 0.005));
                                break;
                                
                            case 'gravity':
                                const gravityForce = Vector.normalise({ x: dx, y: dy });
                                Body.applyForce(body, body.position, Vector.mult(gravityForce, 0.003));
                                break;
                        }
                    }
                }
            });
        }
    });

    document.getElementById('add-circle').addEventListener('click', () => {
        createBody(CANVAS_WIDTH / (2 * pixelRatio), 50, 'circle');
    });

    document.getElementById('add-square').addEventListener('click', () => {
        createBody(CANVAS_WIDTH / (2 * pixelRatio), 50, 'square');
    });

    document.getElementById('add-polygon').addEventListener('click', () => {
        createBody(CANVAS_WIDTH / (2 * pixelRatio), 50, 'polygon');
    });

    document.getElementById('reset-scene').addEventListener('click', () => {
        const removalDelay = 15;
        
        activeBodies.forEach((body, index) => {
            setTimeout(() => {
                createExplosion(body.position.x, body.position.y, 0.5);
                
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

    document.getElementById('toggle-gravity').addEventListener('click', () => {
        const targetY = world.gravity.y === 1 ? 0 : 1;
        const currentY = world.gravity.y;
        const steps = 30;
        
        for (let i = 0; i <= steps; i++) {
            setTimeout(() => {
                const progress = i / steps;
                const easing = progress < 0.5 
                    ? 4 * progress * progress * progress 
                    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
                world.gravity.y = currentY + (targetY - currentY) * easing;
            }, i * 15);
        }
        
        const x = CANVAS_WIDTH / (2 * pixelRatio);
        const y = SCROLL_HEIGHT / (2 * pixelRatio);
        
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

    // Update window resize handler
    window.addEventListener('resize', () => {
        const newWidth = window.innerWidth - 320;
        const newHeight = window.innerHeight;
        
        canvas.width = newWidth * pixelRatio;
        canvas.height = newHeight * pixelRatio;
        canvas.style.width = `${newWidth}px`;
        canvas.style.height = `${newHeight}px`;
        
        canvasContainer.style.width = `${newWidth}px`;
        canvasContainer.style.height = `${newHeight}px`;
        canvasWrapper.style.width = `${newWidth}px`;
        canvasWrapper.style.height = `${newHeight}px`;
        
        render.options.width = canvas.width;
        render.options.height = canvas.height;
        
        boundaries.forEach(boundary => {
            Composite.remove(world, boundary);
        });
        
        createBoundaries();
    });

    canvas.addEventListener('click', (event) => {
        if (mouseConstraint.body) {
            return;
        }
        
        const rect = canvas.getBoundingClientRect();
        const clickX = (event.clientX - rect.left) * pixelRatio;
        const clickY = (event.clientY - rect.top) * pixelRatio;
        
        // Check if click is within the valid canvas area
        if (clickX < 0 || clickX > CANVAS_WIDTH || clickY < 0 || clickY > CANVAS_HEIGHT) {
            return;
        }
        
        const shapeTypes = ['circle', 'square', 'polygon'];
        const randomType = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];
        
        createBody(clickX, clickY, randomType);
    });

    createBoundaries();

    setTimeout(() => {
        for (let i = 0; i < 5; i++) {
            const x = Common.random(100, CANVAS_WIDTH / pixelRatio - 200);
            const y = Common.random(50, 100);
            const type = ['circle', 'square', 'polygon'][Math.floor(Math.random() * 3)];
            createBody(x, y, type);
        }
    }, 500);

    window.debugPhysics = function() {
        console.log("World bodies:", world.bodies.length);
        console.log("Active bodies:", activeBodies.length);
        console.log("Canvas dimensions:", CANVAS_WIDTH, SCROLL_HEIGHT);
        console.log("Gravity:", world.gravity);
        
        createBody(CANVAS_WIDTH / (2 * pixelRatio), 100, 'circle');
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
            this.reset();
        }
        
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 1;
            this.speedX = Math.random() * 2 - 1;
            this.speedY = Math.random() * 2 - 1;
        }
        
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            
            if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
            if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
        }
        
        draw() {
            ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
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
        
        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });
        
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
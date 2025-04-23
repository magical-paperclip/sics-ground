// grab all da matter.js stuf we need
const { 
    Engine, 
    Render, 
    Runner, 
    Body, 
    Bodies, 
    Composite, 
    Mouse, 
    MouseConstraint,
    Events,
    Vector,
    Common,
    Vertices
} = Matter;

// Global variables
let currentMode = 'playground';
let lastMousePos = { x: 0, y: 0 };
let windForce = 0;
let windDirection = 1;
let isWindActive = false;
let windInterval;
let gravity = 1;
let attractorRadius = 100;
let attractorStrength = 0.001;
let isAttractorActive = false;
let attractor = null;
let isDarkMode = false;
let lastClickTime = 0;
let doubleClickThreshold = 300; // 300ms for double-click detection
let isPaused = false; // Track if simulation is paused
let timeScale = 1.0; // For slow-motion effects
let collisionEffectType = 0; // Track current collision effect type

// Theming variables
let currentTheme = 'default';
const themes = {
    default: {
        sparkColors: ['#FF5252', '#2196F3', '#4CAF50', '#FFC107', '#9C27B0']
    },
    neon: {
        sparkColors: ['#00E0FF', '#FF00E4', '#00FF8B', '#FFEB3B', '#FF9800']
    },
    pastel: {
        sparkColors: ['#FFB6C1', '#87CEFA', '#98FB98', '#FFDAB9', '#D8BFD8']
    },
    minimal: {
        sparkColors: ['#333333', '#777777', '#AAAAAA', '#CCCCCC', '#EEEEEE']
    }
};

let boutiqueColors = themes.default;

// Attractor system
let attractors = [];
let attractorMode = false;
let windEnabled = false;
let windStrength = 0.1;
let defaultBounciness = 0.7;
let collisionEffectsEnabled = true;

// Sand particles
let sandParticles = [];

// Performance tracking
let lastFrameTime = null;
let frameRateHistory = Array(30).fill(60);

// Engine variables
let engine, render, runner, mouse, mouseConstraint, canvas;
let draggedBody = null;
let ground, leftWall, rightWall, ceiling;

// Wait for DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', function() {
    initPhysics();
    setupEventListeners();
    addDecorativeElements();
    
    // Populate with some initial shapes
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            addCircle();
            addSquare();
            addTriangle();
            addStar();
        }, i * 200);
    }
});

// Initialize physics engine and environment
function initPhysics() {
    // fire up da physics engien
    engine = Engine.create();
    engine.world.gravity.y = 1;
    engine.timing.timeScale = 0.9;
    // performance tweeks
    engine.enableSleeping = true;

    // set up our canvus
    canvas = document.getElementById('physics-canvas');
    render = Render.create({
        canvas: canvas,
        engine: engine,
        options: {
            width: window.innerWidth,
            height: window.innerHeight,
            wireframes: false,
            background: 'transparent',
            pixelRatio: Math.min(window.devicePixelRatio, 2),        
            showSleeping: false
        }
    });

    // get things runnin
    runner = Runner.create();
    Runner.run(runner, engine);
    Render.run(render);

    // Set up mouse control
    setupMouseControl();
    
    // Create boundaries
    createBoundaries();
    
    // Set up collision event handling
    setupCollisionEvents();
    
    // Set up update loop
    setupUpdateLoop();
}

// Set up mouse control
function setupMouseControl() {
    // set up mouse control wit bettr feel
    mouse = Mouse.create(render.canvas);
    mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: {
            stiffness: 0.4,        
            damping: 0.2,        
            render: {
                visible: true,
                lineWidth: 1,
                strokeStyle: 'rgba(255, 255, 255, 0.5)', 
                type: 'line'
            }
        },
        collisionFilter: {
            category: 0x0001,
            mask: 0xFFFFFFFF
        }
    });

    // lite up what we're draggin
    Events.on(mouseConstraint, 'startdrag', function(event) {
        draggedBody = event.body;
        if (draggedBody) {
            draggedBody.render.lineWidth = 2;
            draggedBody.render.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        }
    });

    // back to normal when we drop it
    Events.on(mouseConstraint, 'enddrag', function(event) {
        if (draggedBody) {
            draggedBody.render.lineWidth = 1;
            draggedBody.render.strokeStyle = draggedBody.originalStrokeStyle || 'rgba(255, 255, 255, 0.2)';
            draggedBody = null;
        }
    });

    // Add mouse constraint to the world
    Composite.add(engine.world, mouseConstraint);

    // Ensure mouse events aren't interpreted by the browser
    render.canvas.addEventListener('mousewheel', function(event) {
        event.preventDefault();
    });
    
    // Listen for clicks on the canvas to place objects or attractors
    canvas.addEventListener('click', function(event) {
        // Update mouse position
        lastMousePos.x = event.clientX;
        lastMousePos.y = event.clientY;
        
        if (attractorMode) {
            createAttractor(event.clientX, event.clientY);
        } else {
            // If we're in normal mode, place the current shape
            // Check if any of the creation buttons are active
            const activeButtonId = document.querySelector('.shape-button.active')?.id;
            
            if (activeButtonId) {
                switch(activeButtonId) {
                    case 'add-circle': addCircle(); break;
                    case 'add-square': addSquare(); break;
                    case 'add-triangle': addTriangle(); break;
                    case 'add-star': addStar(); break;
                    case 'add-sand': 
                        for (let i = 0; i < 20; i++) {
                            addSandParticle();
                        }
                        break;
                    case 'add-text':
                        const text = prompt('Enter text:', 'Hello');
                        if (text) {
                            createTextObject(text, {x: event.clientX, y: event.clientY});
                        }
                        break;
                }
            }
        }
        
        // Double-click to remove an attractor
        const currentTime = new Date().getTime();
        if (currentTime - lastClickTime < doubleClickThreshold) {
            // Look for attractors near the click
            attractors.forEach(attractor => {
                const distance = Math.sqrt(
                    Math.pow(event.clientX - attractor.position.x, 2) + 
                    Math.pow(event.clientY - attractor.position.y, 2)
                );
                
                if (distance < 100) {
                    removeAttractor(attractor);
                }
            });
        }
        
        lastClickTime = currentTime;
    });
}

// Track mouse position continuously
document.addEventListener('mousemove', function(event) {
    lastMousePos = { x: event.clientX, y: event.clientY };
});

// Create boundaries (ground, walls, ceiling)
function createBoundaries() {
    const wallThickness = 50;
    ground = Bodies.rectangle(
        window.innerWidth / 2, 
        window.innerHeight, 
        window.innerWidth, 
        wallThickness, 
        { 
            isStatic: true,
            render: {
                fillStyle: 'transparent',
                strokeStyle: 'rgba(255, 255, 255, 0.2)',
                lineWidth: 1
            }
        }
    );

    leftWall = Bodies.rectangle(
        0, 
        window.innerHeight / 2, 
        wallThickness, 
        window.innerHeight, 
        { 
            isStatic: true,
            render: {
                fillStyle: 'transparent',
                strokeStyle: 'rgba(255, 255, 255, 0.2)',
                lineWidth: 1
            }
        }
    );

    rightWall = Bodies.rectangle(
        window.innerWidth, 
        window.innerHeight / 2, 
        wallThickness, 
        window.innerHeight, 
        { 
            isStatic: true,
            render: {
                fillStyle: 'transparent',
                strokeStyle: 'rgba(255, 255, 255, 0.2)',
                lineWidth: 1
            }
        }
    );

    ceiling = Bodies.rectangle(
        window.innerWidth / 2, 
        0, 
        window.innerWidth, 
        wallThickness, 
        { 
            isStatic: true,
            render: {
                fillStyle: 'transparent',
                strokeStyle: 'rgba(255, 255, 255, 0.2)',
                lineWidth: 1
            }
        }
    );

    // Add all static bodies to the world
    Composite.add(engine.world, [ground, leftWall, rightWall, ceiling]);
}

// Set up all event listeners
function setupEventListeners() {
    // Set up our shape button listeners to toggle active state
    const shapeButtons = ['add-circle', 'add-square', 'add-triangle', 'add-star', 'add-sand', 'add-text'];
    
    shapeButtons.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        // Add shape-button class to all shape buttons
        button.classList.add('shape-button');
        
        button.addEventListener('click', () => {
            // If already active, deactivate it
            if (button.classList.contains('active')) {
                button.classList.remove('active');
                return;
            }
            
            // Deactivate all other shape buttons
            shapeButtons.forEach(id => {
                document.getElementById(id).classList.remove('active');
            });
            
            // Activate this button
            button.classList.add('active');
            
            // Show message about what to do
            showFloatingMessage(`Now click anywhere on the canvas to add ${buttonId.replace('add-', '')}`);
        });
    });

    // Add keyboard shortcuts
    document.addEventListener('keydown', function(event) {
        // Only respond to keyboard shortcuts if not typing in an input field
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
        
        switch(event.key.toLowerCase()) {
            case 'c': 
                document.getElementById('add-circle').click();
                break;
            case 's': 
                document.getElementById('add-square').click();
                break;
            case 't': 
                document.getElementById('add-triangle').click();
                break;
            case 'a': 
                document.getElementById('add-star').click();
                break;
            case 'd': 
                document.getElementById('add-sand').click();
                break;
            case 'w': 
                document.getElementById('toggle-wind').click();
                break;
            case 'e': 
                document.getElementById('toggle-collision-sparks').click();
                break;
            case 'x': 
                clearNonStaticBodies();
                break;
            case 'p':
                togglePause();
                break;
            case ' ': // Space key for explosion
                createExplosion(lastMousePos);
                break;
            case 'enter':
                document.getElementById('add-text').click();
                break;
            case 'escape':
                // Deactivate all shape buttons when pressing Escape
                document.querySelectorAll('.shape-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                break;
        }
    });

    // Explosion button
    document.getElementById('create-explosion').addEventListener('click', function() {
        createExplosion(lastMousePos);
        showFloatingMessage('Boom!');
    });
    
    // Pause button
    document.getElementById('toggle-pause').addEventListener('click', togglePause);

    // Handle tab switching
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', function() {
            // Toggle active tab button
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            this.classList.add('active');
            
            // Toggle tab content
            const tabId = this.getAttribute('data-tab');
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tabId + '-tab').classList.add('active');
            
            // Set current mode
            currentMode = tabId;
            
            // Reset attractorMode when switching tabs
            attractorMode = false;
            document.getElementById('add-attractor').textContent = 'Add Attractor';
        });
    });

    // Initialize the theme from select
    const themeSelect = document.getElementById('theme-select');
    themeSelect.addEventListener('change', function() {
        setTheme(this.value);
    });

    // Gravity control
    document.getElementById('gravity-slider').addEventListener('input', function() {
        engine.world.gravity.y = parseFloat(this.value);
    });

    // Wind strength control
    document.getElementById('wind-slider').addEventListener('input', function() {
        windStrength = parseFloat(this.value);
    });

    // Bounciness control
    document.getElementById('bounce-slider').addEventListener('input', function() {
        defaultBounciness = parseFloat(this.value);
    });

    // Handle window resize
    window.addEventListener('resize', debounce(function() {
        // Update canvas size
        render.options.width = window.innerWidth;
        render.options.height = window.innerHeight;
        render.canvas.width = window.innerWidth;
        render.canvas.height = window.innerHeight;
        
        // Update wall positions
        Body.setPosition(ground, { x: window.innerWidth / 2, y: window.innerHeight });
        Body.setPosition(leftWall, { x: 0, y: window.innerHeight / 2 });
        Body.setPosition(rightWall, { x: window.innerWidth, y: window.innerHeight / 2 });
        Body.setPosition(ceiling, { x: window.innerWidth / 2, y: 0 });
    }, 250));

    document.getElementById('toggle-wind').addEventListener('click', function() {
        windEnabled = !windEnabled;
        this.textContent = windEnabled ? 'Disable Wind' : 'Enable Wind';
    });

    document.getElementById('toggle-collision-sparks').addEventListener('click', function() {
        if (!collisionEffectsEnabled) {
            // If effects were off, turn them on with current type
            collisionEffectsEnabled = true;
        } else {
            // Cycle through effect types
            collisionEffectType = (collisionEffectType + 1) % 5;
        }
        
        // Show what effect is active now
        const effectNames = ['Classic Particles', 'Star Burst', 'Trails', 'Glow', 'Ripples'];
        this.textContent = `Effect: ${effectNames[collisionEffectType]}`;
        showFloatingMessage(`Collision effect: ${effectNames[collisionEffectType]}`);
    });

    document.getElementById('add-attractor').addEventListener('click', function() {
        // Toggle attractor mode
        attractorMode = !attractorMode;
        this.textContent = attractorMode ? 'Cancel Attractor' : 'Add Attractor';
        
        // Show info modal for attractor mode
        if (attractorMode) {
            document.getElementById('info-modal').style.display = 'flex';
        }
    });
}

// Setup collision events
function setupCollisionEvents() {
    Events.on(engine, 'collisionStart', function(event) {
        if (!collisionEffectsEnabled) return;
        
        const pairs = event.pairs;
        
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            
            // Skip collisions with walls and static objects
            if (pair.bodyA.isStatic || pair.bodyB.isStatic) continue;
            
            // Calculate collision velocity magnitude
            const velA = pair.bodyA.velocity;
            const velB = pair.bodyB.velocity;
            const relativeVelocity = Math.sqrt(
                Math.pow(velA.x - velB.x, 2) + 
                Math.pow(velA.y - velB.y, 2)
            );
            
            // Skip low-energy collisions
            if (relativeVelocity < 3) continue;
            
            // Calculate collision point
            const collision = pair.collision;
            const pos = collision.supports[0] || { 
                x: (pair.bodyA.position.x + pair.bodyB.position.x) / 2,
                y: (pair.bodyA.position.y + pair.bodyB.position.y) / 2
            };
            
            // Create visual effect at collision point
            const sparkCount = Math.min(10, Math.floor(relativeVelocity / 2));
            
            // Random color from theme
            const sparkColors = boutiqueColors.sparkColors;
            const sparkColor = sparkColors[Math.floor(Math.random() * sparkColors.length)];
            
            // Create collision particles
            for (let j = 0; j < sparkCount; j++) {
                createCollisionParticle(pos, relativeVelocity / 2, sparkColor);
            }
        }
    });
}

// Set up the main render/update loop
function setupUpdateLoop() {
    // Override the standard render function to add text rendering
    const originalRender = render.render;
    render.render = function() {
        originalRender.apply(this, arguments);
        
        // Get the rendering context
        const context = render.context;
        const bodies = Composite.allBodies(engine.world);
        
        context.font = '20px Arial, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Render text for text objects
        bodies.forEach(body => {
            if (body.isTextObject) {
                // Save the current transform
                context.save();
                
                // Translate and rotate to match the body
                context.translate(body.position.x, body.position.y);
                context.rotate(body.angle);
                
                // Draw the text
                context.fillStyle = body.fontColor || '#FFFFFF';
                context.fillText(body.textContent, 0, 0);
                
                // Restore the transform
                context.restore();
            }
        });
    };

    Events.on(engine, 'beforeUpdate', function() {
        // Track current time
        const now = performance.now();
        
        // Calculate frame rate
        if (lastFrameTime) {
            const fps = 1000 / (now - lastFrameTime);
            frameRateHistory.push(fps);
            frameRateHistory.shift();
        }
        lastFrameTime = now;
        
        // Apply wind if enabled
        if (windEnabled) {
            applyWind();
        }
        
        // Apply attractor forces
        applyAttractorForces();
        
        // Clean up sand particles if there are too many (performance optimization)
        if (sandParticles.length > 500) {
            const toRemove = sandParticles.splice(0, 100);
            toRemove.forEach(particle => {
                Composite.remove(engine.world, particle);
            });
        }
    });
}

// SHAPE CREATION FUNCTIONS
function addCircle() {
    const radius = 20 + Math.random() * 30;
    const circle = Bodies.circle(
        lastMousePos.x,
        lastMousePos.y,
        radius,
        {
            restitution: defaultBounciness,
            friction: 0.1,
            frictionAir: 0.001,
            render: {
                fillStyle: getRandomColorFromTheme(),
                strokeStyle: 'rgba(255, 255, 255, 0.3)',
                lineWidth: 1
            }
        }
    );
    
    circle.originalStrokeStyle = 'rgba(255, 255, 255, 0.3)';
    
    Composite.add(engine.world, circle);
    return circle;
}

function addSquare() {
    const size = 20 + Math.random() * 40;
    const square = Bodies.rectangle(
        lastMousePos.x,
        lastMousePos.y,
        size,
        size,
        {
            restitution: defaultBounciness,
            friction: 0.1,
            frictionAir: 0.001,
            render: {
                fillStyle: getRandomColorFromTheme(),
                strokeStyle: 'rgba(255, 255, 255, 0.3)',
                lineWidth: 1
            }
        }
    );
    
    square.originalStrokeStyle = 'rgba(255, 255, 255, 0.3)';
    
    Composite.add(engine.world, square);
    return square;
}

function addTriangle() {
    const size = 25 + Math.random() * 40;
    const height = size * Math.sqrt(3) / 2;
    
    const vertices = [
        { x: 0, y: -height / 2 },
        { x: -size / 2, y: height / 2 },
        { x: size / 2, y: height / 2 }
    ];
    
    const triangle = Bodies.fromVertices(
        lastMousePos.x,
        lastMousePos.y,
        [vertices],
        {
            restitution: defaultBounciness,
            friction: 0.1,
            frictionAir: 0.001,
            render: {
                fillStyle: getRandomColorFromTheme(),
                strokeStyle: 'rgba(255, 255, 255, 0.3)',
                lineWidth: 1
            }
        }
    );
    
    triangle.originalStrokeStyle = 'rgba(255, 255, 255, 0.3)';
    
    Composite.add(engine.world, triangle);
    return triangle;
}

function addStar() {
    const outerRadius = 25 + Math.random() * 20;
    const innerRadius = outerRadius * 0.4;
    const points = 5;
    
    const vertices = [];
    for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (Math.PI / points) * i;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        vertices.push({ x, y });
    }
    
    const star = Bodies.fromVertices(
        lastMousePos.x,
        lastMousePos.y,
        [vertices],
        {
            restitution: defaultBounciness,
            friction: 0.1,
            frictionAir: 0.001,
            render: {
                fillStyle: getRandomColorFromTheme(),
                strokeStyle: 'rgba(255, 255, 255, 0.3)',
                lineWidth: 1
            }
        }
    );
    
    star.originalStrokeStyle = 'rgba(255, 255, 255, 0.3)';
    
    Composite.add(engine.world, star);
    return star;
}

function addSandParticle() {
    const size = 5 + Math.random() * 5;
    const x = lastMousePos.x + (Math.random() - 0.5) * 30;
    const y = lastMousePos.y + (Math.random() - 0.5) * 30;
    
    const particle = Bodies.circle(
        x, y, size,
        {
            restitution: 0.3,
            friction: 0.8,
            frictionAir: 0.02,
            render: {
                fillStyle: getRandomColorFromTheme(),
                strokeStyle: 'rgba(255, 255, 255, 0.1)',
                lineWidth: 1
            }
        }
    );
    
    // Add to world and track
    Composite.add(engine.world, particle);
    sandParticles.push(particle);
    
    return particle;
}

// Add decorative elements
function addDecorativeElements() {
    // Create some decorative fixed elements
    const decorCount = 5;
    
    for (let i = 0; i < decorCount; i++) {
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;
        const size = 5 + Math.random() * 10;
        
        const element = document.createElement('div');
        element.className = 'decoration';
        element.style.width = size + 'px';
        element.style.height = size + 'px';
        element.style.borderRadius = '50%';
        element.style.background = 'rgba(255, 255, 255, 0.2)';
        element.style.position = 'absolute';
        element.style.left = x + 'px';
        element.style.top = y + 'px';
        
        document.body.appendChild(element);
    }
}

// Helper to get random color from current theme
function getRandomColorFromTheme() {
    const colors = boutiqueColors.sparkColors;
    return colors[Math.floor(Math.random() * colors.length)];
}

// Create and manage attractors
function createAttractor(x, y) {
    const strength = 0.1;
    const radius = 100;
    
    // Create attractor object
    const attractor = {
        position: { x, y },
        strength: strength,
        radius: radius
    };
    
    // Add to array
    attractors.push(attractor);
    
    // Create visual element
    const element = document.createElement('div');
    element.className = 'attractor';
    element.style.width = (radius * 2) + 'px';
    element.style.height = (radius * 2) + 'px';
    element.style.left = (x - radius) + 'px';
    element.style.top = (y - radius) + 'px';
    document.body.appendChild(element);
    
    // Reference the DOM element
    attractor.element = element;
    
    // Return the attractor
    return attractor;
}

function removeAttractor(attractor) {
    // Remove from array
    const index = attractors.indexOf(attractor);
    if (index !== -1) {
        attractors.splice(index, 1);
    }
    
    // Remove DOM element
    if (attractor.element && attractor.element.parentNode) {
        attractor.element.parentNode.removeChild(attractor.element);
    }
}

function applyAttractorForces() {
    if (attractors.length === 0) return;
    
    const bodies = Composite.allBodies(engine.world);
    
    // Apply force from each attractor to each body
    attractors.forEach(attractor => {
        bodies.forEach(body => {
            if (body.isStatic) return;
            
            const dx = attractor.position.x - body.position.x;
            const dy = attractor.position.y - body.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < attractor.radius * 2) {
                const force = attractor.strength / Math.max(distance, 10);
                const forceMagnitude = 0.001 * body.mass * force;
                
                Body.applyForce(body, body.position, {
                    x: (dx / distance) * forceMagnitude,
                    y: (dy / distance) * forceMagnitude
                });
            }
        });
    });
}

// Create particle for collision effects
function createCollisionParticle(position, size, color) {
    // Different effect types based on current collisionEffectType
    switch (collisionEffectType) {
        case 0: // Standard circle particles
            createCircleParticle(position, size, color);
            break;
        case 1: // Star burst effect
            createStarBurstParticle(position, size, color);
            break;
        case 2: // Trail effect
            createTrailParticle(position, size, color);
            break;
        case 3: // Glow effect
            createGlowParticle(position, size, color);
            break;
        case 4: // Ripple effect
            createRippleEffect(position, size, color);
            break;
    }
}

// Standard circle particles
function createCircleParticle(position, size, color) {
    const particle = document.createElement('div');
    particle.className = 'collision-particle';
    particle.style.position = 'absolute';
    particle.style.left = position.x + 'px';
    particle.style.top = position.y + 'px';
    particle.style.width = (size * 2) + 'px';
    particle.style.height = (size * 2) + 'px';
    particle.style.backgroundColor = color || '#fff';
    particle.style.borderRadius = '50%';
    particle.style.transform = 'translate(-50%, -50%)';
    particle.style.zIndex = '5';
    particle.style.pointerEvents = 'none';
    particle.style.transition = 'opacity 0.1s ease';
    document.body.appendChild(particle);
    
    // Random direction with smoother movement
    const angle = Math.random() * Math.PI * 2;
    const velocity = {
        x: Math.cos(angle) * (0.5 + Math.random() * 1.5),
        y: Math.sin(angle) * (0.5 + Math.random() * 1.5) - 0.8 // Gentler upward bias
    };
    
    // Initial position
    let x = position.x;
    let y = position.y;
    let opacity = 1;
    let currentSize = size;
    
    // Animate the particle with smoother transitions
    function animateParticle() {
        x += velocity.x;
        y += velocity.y;
        velocity.y += 0.025; // Reduced gravity for smoother fall
        opacity -= 0.02; // Slower opacity reduction
        currentSize *= 0.98; // Gentler size reduction
        
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        particle.style.opacity = opacity;
        particle.style.width = (currentSize * 2) + 'px';
        particle.style.height = (currentSize * 2) + 'px';
        
        if (opacity > 0) {
            requestAnimationFrame(animateParticle);
        } else {
            particle.remove();
        }
    }
    
    requestAnimationFrame(animateParticle);
}

// Star burst particles
function createStarBurstParticle(position, size, color) {
    const particle = document.createElement('div');
    particle.className = 'collision-particle star-particle';
    particle.style.position = 'absolute';
    particle.style.left = position.x + 'px';
    particle.style.top = position.y + 'px';
    particle.style.width = (size * 2) + 'px';
    particle.style.height = (size * 2) + 'px';
    particle.style.background = color || '#fff';
    particle.style.clipPath = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
    particle.style.transform = 'translate(-50%, -50%)';
    particle.style.zIndex = '5';
    particle.style.pointerEvents = 'none';
    particle.style.transition = 'opacity 0.1s ease';
    document.body.appendChild(particle);
    
    // Random direction with more controlled movement
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 1.5; // Reduced speed range
    const velocity = {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed - 0.5 // Slight upward drift
    };
    
    // Initial position
    let x = position.x;
    let y = position.y;
    let opacity = 1;
    let currentSize = size;
    let rotation = 0;
    
    // Animate the particle
    function animateParticle() {
        x += velocity.x;
        y += velocity.y;
        velocity.y += 0.02; // Gentler gravity
        opacity -= 0.015; // Slower opacity fade
        currentSize *= 1.005; // More gradual growth
        rotation += 2; // Slower rotation (was 5)
        
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        particle.style.opacity = opacity;
        particle.style.width = (currentSize * 2) + 'px';
        particle.style.height = (currentSize * 2) + 'px';
        particle.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
        
        if (opacity > 0) {
            requestAnimationFrame(animateParticle);
        } else {
            particle.remove();
        }
    }
    
    requestAnimationFrame(animateParticle);
}

// Trail particles
function createTrailParticle(position, size, color) {
    // Create multiple smaller particles that follow a path
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            const particle = document.createElement('div');
            particle.className = 'collision-particle trail-particle';
            particle.style.position = 'absolute';
            particle.style.left = position.x + 'px';
            particle.style.top = position.y + 'px';
            particle.style.width = (size * 0.8) + 'px';
            particle.style.height = (size * 0.8) + 'px';
            particle.style.backgroundColor = color || '#fff';
            particle.style.borderRadius = '50%';
            particle.style.transform = 'translate(-50%, -50%)';
            particle.style.zIndex = '5';
            particle.style.pointerEvents = 'none';
            particle.style.boxShadow = `0 0 ${size/2}px ${color || '#fff'}`;
            particle.style.transition = 'opacity 0.15s ease';
            document.body.appendChild(particle);
            
            // Create a curved path with smoother movement
            const baseAngle = Math.random() * Math.PI * 2;
            const curveFactor = Math.random() * 0.05 - 0.025; // Reduced curve factor
            let curX = position.x;
            let curY = position.y;
            let t = 0;
            let opacity = 0.7;
            let prevTime = performance.now();
            
            function animateTrail() {
                const now = performance.now();
                const deltaTime = Math.min(30, now - prevTime) / 16.67; // Normalize to ~60fps
                prevTime = now;
                
                t += 0.03 * deltaTime; // More consistent speed regardless of frame rate
                const angle = baseAngle + curveFactor * t;
                curX += Math.cos(angle) * 1.5 * deltaTime;
                curY += Math.sin(angle) * 1.5 * deltaTime;
                opacity -= 0.008 * deltaTime;
                
                particle.style.left = curX + 'px';
                particle.style.top = curY + 'px';
                particle.style.opacity = opacity;
                
                if (opacity > 0 && t < 20) {
                    requestAnimationFrame(animateTrail);
                } else {
                    particle.remove();
                }
            }
            
            requestAnimationFrame(animateTrail);
        }, i * 70); // More separated staggered start
    }
}

// Glow particles
function createGlowParticle(position, size, color) {
    const particle = document.createElement('div');
    particle.className = 'collision-particle glow-particle';
    particle.style.position = 'absolute';
    particle.style.left = position.x + 'px';
    particle.style.top = position.y + 'px';
    particle.style.width = (size * 2) + 'px';
    particle.style.height = (size * 2) + 'px';
    particle.style.background = 'transparent';
    particle.style.borderRadius = '50%';
    particle.style.boxShadow = `0 0 ${size*2}px ${color || '#fff'}, 0 0 ${size}px #fff`;
    particle.style.transform = 'translate(-50%, -50%)';
    particle.style.zIndex = '5';
    particle.style.pointerEvents = 'none';
    particle.style.transition = 'opacity 0.2s ease';
    document.body.appendChild(particle);
    
    // Use frame time tracking for consistent animation
    let prevTime = performance.now();
    
    // Random direction, slower than normal particles
    const angle = Math.random() * Math.PI * 2;
    const velocity = {
        x: Math.cos(angle) * (0.3 + Math.random() * 0.7),
        y: Math.sin(angle) * (0.3 + Math.random() * 0.7) - 0.3
    };
    
    // Initial position
    let x = position.x;
    let y = position.y;
    let opacity = 1;
    let currentSize = size;
    
    // Animate the particle with frame timing
    function animateParticle() {
        const now = performance.now();
        const deltaTime = Math.min(30, now - prevTime) / 16.67; // Normalize to ~60fps
        prevTime = now;
        
        x += velocity.x * deltaTime;
        y += velocity.y * deltaTime;
        velocity.y += 0.01 * deltaTime; // Very gentle gravity
        opacity -= 0.01 * deltaTime;
        currentSize *= (1 + 0.01 * deltaTime); // Gradual growth
        
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        particle.style.opacity = opacity;
        particle.style.width = (currentSize * 2) + 'px';
        particle.style.height = (currentSize * 2) + 'px';
        particle.style.boxShadow = `0 0 ${currentSize*2}px ${color || '#fff'}, 0 0 ${currentSize}px #fff`;
        
        if (opacity > 0) {
            requestAnimationFrame(animateParticle);
        } else {
            particle.remove();
        }
    }
    
    requestAnimationFrame(animateParticle);
}

// Ripple effect
function createRippleEffect(position, size, color) {
    const ripple = document.createElement('div');
    ripple.className = 'collision-particle ripple-effect';
    ripple.style.position = 'absolute';
    ripple.style.left = position.x + 'px';
    ripple.style.top = position.y + 'px';
    ripple.style.width = (size * 2) + 'px';
    ripple.style.height = (size * 2) + 'px';
    ripple.style.borderRadius = '50%';
    ripple.style.border = `2px solid ${color || '#fff'}`;
    ripple.style.transform = 'translate(-50%, -50%)';
    ripple.style.zIndex = '5';
    ripple.style.pointerEvents = 'none';
    ripple.style.transition = 'opacity 0.15s ease';
    document.body.appendChild(ripple);
    
    // Use frame time tracking for consistent animation
    let prevTime = performance.now();
    let currentSize = size;
    let opacity = 1;
    
    function animateRipple() {
        const now = performance.now();
        const deltaTime = Math.min(30, now - prevTime) / 16.67; // Normalize to ~60fps
        prevTime = now;
        
        // Smoother growth with frame timing
        currentSize *= (1 + 0.03 * deltaTime);
        opacity -= 0.01 * deltaTime;
        
        ripple.style.width = (currentSize * 2) + 'px';
        ripple.style.height = (currentSize * 2) + 'px';
        ripple.style.opacity = opacity;
        
        if (opacity > 0) {
            requestAnimationFrame(animateRipple);
        } else {
            ripple.remove();
        }
    }
    
    requestAnimationFrame(animateRipple);
}

// Apply wind force to all bodies
function applyWind() {
    const bodies = Composite.allBodies(engine.world);
    
    // Vary wind direction and strength over time
    const time = Date.now() / 1000;
    const windX = Math.sin(time * 0.3) * windStrength;
    
    bodies.forEach(body => {
        if (body.isStatic || body === draggedBody) return;
        
        // Apply stronger wind to bodies higher up
        const heightFactor = 1 - (body.position.y / window.innerHeight);
        const force = {
            x: windX * heightFactor * body.area * 0.0005,
            y: 0
        };
        
        Body.applyForce(body, body.position, force);
    });
}

// Save and load functionality
function savePlaygroundState() {
    const bodies = Composite.allBodies(engine.world).filter(body => !body.isStatic);
    const saveData = {
        bodies: bodies.map(body => ({
            position: body.position,
            velocity: body.velocity,
            angularVelocity: body.angularVelocity,
            angle: body.angle,
            // Store the type based on vertices count
            type: body.vertices.length === 8 ? 'star' :
                  body.vertices.length === 3 ? 'triangle' :
                  body.vertices.length === 4 ? 'square' : 'circle',
            // Store size based on type
            size: body.type === 'circle' ? body.circleRadius :
                 Math.abs(body.vertices[0].x - body.vertices[2].x) / 2,
            // Store color
            color: body.render.fillStyle
        })),
        attractors: attractors.map(a => ({
            position: a.position,
            strength: a.strength,
            radius: a.radius
        })),
        settings: {
            gravity: engine.world.gravity.y,
            windEnabled: windEnabled,
            windStrength: windStrength,
            bounciness: defaultBounciness,
            theme: currentTheme
        }
    };
    
    localStorage.setItem('playgroundState', JSON.stringify(saveData));
    
    // Provide feedback
    showSavedMessage();
}

function showSavedMessage() {
    const message = document.createElement('div');
    message.style.position = 'absolute';
    message.style.top = '20px';
    message.style.left = '50%';
    message.style.transform = 'translateX(-50%)';
    message.style.background = 'rgba(255, 255, 255, 0.8)';
    message.style.color = '#333';
    message.style.padding = '10px 20px';
    message.style.borderRadius = '20px';
    message.style.zIndex = '100';
    message.style.fontWeight = '500';
    message.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
    message.textContent = 'State saved';
    document.body.appendChild(message);
    
    // Fade out and remove
    setTimeout(() => {
        message.style.opacity = '0';
        message.style.transition = 'opacity 0.5s ease';
        setTimeout(() => message.remove(), 500);
    }, 1500);
}

function loadPlaygroundState() {
    const savedState = localStorage.getItem('playgroundState');
    if (!savedState) return;
    
    const state = JSON.parse(savedState);
    
    // Clear current bodies except static ones
    clearNonStaticBodies();
    
    // Clear attractors
    attractors.forEach(a => {
        if (a.element && a.element.parentNode) {
            a.element.parentNode.removeChild(a.element);
        }
    });
    attractors = [];
    
    // Apply settings
    if (state.settings) {
        engine.world.gravity.y = state.settings.gravity || 1;
        document.getElementById('gravity-slider').value = engine.world.gravity.y;
        
        windEnabled = state.settings.windEnabled || false;
        document.getElementById('toggle-wind').textContent = windEnabled ? 'Disable Wind' : 'Enable Wind';
        
        windStrength = state.settings.windStrength || 0.1;
        document.getElementById('wind-slider').value = windStrength;
        
        defaultBounciness = state.settings.bounciness || 0.7;
        document.getElementById('bounce-slider').value = defaultBounciness;
        
        // Set theme
        if (state.settings.theme) {
            setTheme(state.settings.theme);
            document.getElementById('theme-select').value = state.settings.theme;
        }
    }
    
    // Create bodies
    if (state.bodies) {
        state.bodies.forEach(bodyData => {
            let body;
            
            // Create appropriate shape
            switch (bodyData.type) {
                case 'circle':
                    body = Bodies.circle(
                        bodyData.position.x,
                        bodyData.position.y,
                        bodyData.size,
                        {
                            restitution: defaultBounciness,
                            render: { fillStyle: bodyData.color }
                        }
                    );
                    break;
                case 'square':
                    body = Bodies.rectangle(
                        bodyData.position.x,
                        bodyData.position.y,
                        bodyData.size * 2,
                        bodyData.size * 2,
                        {
                            restitution: defaultBounciness,
                            render: { fillStyle: bodyData.color }
                        }
                    );
                    break;
                case 'triangle':
                    const size = bodyData.size * 2;
                    const height = size * Math.sqrt(3) / 2;
                    
                    const vertices = [
                        { x: 0, y: -height / 2 },
                        { x: -size / 2, y: height / 2 },
                        { x: size / 2, y: height / 2 }
                    ];
                    
                    body = Bodies.fromVertices(
                        bodyData.position.x,
                        bodyData.position.y,
                        [vertices],
                        {
                            restitution: defaultBounciness,
                            render: { fillStyle: bodyData.color }
                        }
                    );
                    break;
                case 'star':
                    const outerRadius = bodyData.size;
                    const innerRadius = outerRadius * 0.4;
                    const points = 5;
                    
                    const starVertices = [];
                    for (let i = 0; i < points * 2; i++) {
                        const radius = i % 2 === 0 ? outerRadius : innerRadius;
                        const angle = (Math.PI / points) * i;
                        const x = Math.cos(angle) * radius;
                        const y = Math.sin(angle) * radius;
                        starVertices.push({ x, y });
                    }
                    
                    body = Bodies.fromVertices(
                        bodyData.position.x,
                        bodyData.position.y,
                        [starVertices],
                        {
                            restitution: defaultBounciness,
                            render: { fillStyle: bodyData.color }
                        }
                    );
                    break;
            }
            
            if (body) {
                // Apply physics properties
                Body.setVelocity(body, bodyData.velocity);
                Body.setAngularVelocity(body, bodyData.angularVelocity);
                Body.setAngle(body, bodyData.angle);
                
                // Add to world
                Composite.add(engine.world, body);
            }
        });
    }
    
    // Create attractors
    if (state.attractors) {
        state.attractors.forEach(attractorData => {
            createAttractor(attractorData.position.x, attractorData.position.y);
        });
    }
}

function clearNonStaticBodies() {
    const bodies = Composite.allBodies(engine.world);
    
    bodies.forEach(body => {
        if (!body.isStatic) {
            Composite.remove(engine.world, body);
        }
    });
    
    sandParticles = [];
}

// debounce functoin for smoother window resize
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Function to set the theme
function setTheme(theme) {
    // Update the boutiqueColors reference
    boutiqueColors = themes[theme];
    
    // Update body class for CSS styles
    document.body.className = '';
    document.body.classList.add(theme + '-theme');
    
    // Save theme
    currentTheme = theme;
}

// Function to toggle pause state
function togglePause() {
    isPaused = !isPaused;
    
    if (isPaused) {
        // Pause the simulation
        Runner.stop(runner);
        
        // Create a pause indicator
        const pauseIndicator = document.createElement('div');
        pauseIndicator.id = 'pause-indicator';
        pauseIndicator.textContent = 'PAUSED';
        pauseIndicator.style.position = 'absolute';
        pauseIndicator.style.top = '50%';
        pauseIndicator.style.left = '50%';
        pauseIndicator.style.transform = 'translate(-50%, -50%)';
        pauseIndicator.style.color = 'rgba(255, 255, 255, 0.8)';
        pauseIndicator.style.fontSize = '3rem';
        pauseIndicator.style.fontWeight = 'bold';
        pauseIndicator.style.zIndex = '100';
        pauseIndicator.style.pointerEvents = 'none';
        pauseIndicator.style.textShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
        document.body.appendChild(pauseIndicator);
    } else {
        // Resume the simulation
        Runner.start(runner, engine);
        
        // Remove pause indicator
        const pauseIndicator = document.getElementById('pause-indicator');
        if (pauseIndicator) {
            pauseIndicator.remove();
        }
    }
    
    // Show message
    showFloatingMessage(isPaused ? 'Paused (P to resume)' : 'Resumed');
}

// Function for showing temporary floating messages
function showFloatingMessage(text) {
    const message = document.createElement('div');
    message.style.position = 'absolute';
    message.style.top = '80px';
    message.style.left = '50%';
    message.style.transform = 'translateX(-50%)';
    message.style.background = 'rgba(0, 0, 0, 0.7)';
    message.style.color = 'white';
    message.style.padding = '10px 20px';
    message.style.borderRadius = '20px';
    message.style.zIndex = '100';
    message.style.fontWeight = '500';
    message.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
    message.textContent = text;
    document.body.appendChild(message);
    
    // Fade out and remove
    setTimeout(() => {
        message.style.opacity = '0';
        message.style.transition = 'opacity 0.5s ease';
        setTimeout(() => message.remove(), 500);
    }, 1500);
}

// Function to create an explosion effect at a given position
function createExplosion(position, radius = 200, strength = 0.05) {
    // Visual effect
    const explosion = document.createElement('div');
    explosion.className = 'explosion';
    explosion.style.position = 'absolute';
    explosion.style.left = position.x + 'px';
    explosion.style.top = position.y + 'px';
    explosion.style.width = radius * 2 + 'px';
    explosion.style.height = radius * 2 + 'px';
    explosion.style.transform = 'translate(-50%, -50%)';
    explosion.style.background = 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,200,100,0.4) 40%, rgba(255,100,50,0) 70%)';
    explosion.style.borderRadius = '50%';
    explosion.style.zIndex = '10';
    explosion.style.pointerEvents = 'none';
    document.body.appendChild(explosion);
    
    // Animate explosion
    let scale = 0;
    const animate = () => {
        scale += 0.1;
        explosion.style.transform = `translate(-50%, -50%) scale(${scale})`;
        explosion.style.opacity = 1 - scale/2;
        
        if (scale < 2) {
            requestAnimationFrame(animate);
        } else {
            explosion.remove();
        }
    };
    animate();
    
    // Apply forces to nearby bodies
    const bodies = Composite.allBodies(engine.world);
    
    bodies.forEach(body => {
        if (body.isStatic) return;
        
        const dx = body.position.x - position.x;
        const dy = body.position.y - position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < radius) {
            // Calculate force inversely proportional to distance
            const forceMagnitude = strength * (1 - distance / radius) * body.mass;
            const angle = Math.atan2(dy, dx);
            
            Body.applyForce(body, body.position, {
                x: Math.cos(angle) * forceMagnitude,
                y: Math.sin(angle) * forceMagnitude
            });
            
            // Create explosion particles
            const sparkCount = Math.floor(Math.random() * 3) + 1;
            for (let i = 0; i < sparkCount; i++) {
                createCollisionParticle(
                    { x: position.x + dx/2, y: position.y + dy/2 },
                    5 + Math.random() * 5,
                    getRandomColorFromTheme()
                );
            }
        }
    });
    
    // Create additional explosion particles
    for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * radius * 0.7;
        createCollisionParticle(
            { 
                x: position.x + Math.cos(angle) * dist, 
                y: position.y + Math.sin(angle) * dist 
            },
            5 + Math.random() * 10,
            getRandomColorFromTheme()
        );
    }
    
    // Play explosion sound effect (optional)
    // const audio = new Audio('explosion.mp3');
    // audio.volume = 0.3;
    // audio.play();
}

// Function to create a text object that behaves as a physics body
function createTextObject(text = "Hello", position = lastMousePos) {
    // Create a DOM element to measure text dimensions
    const measureElement = document.createElement('div');
    measureElement.style.position = 'absolute';
    measureElement.style.visibility = 'hidden';
    measureElement.style.fontSize = '20px';
    measureElement.style.fontFamily = 'Arial, sans-serif';
    measureElement.style.fontWeight = 'bold';
    measureElement.style.padding = '5px';
    measureElement.textContent = text;
    document.body.appendChild(measureElement);
    
    // Measure the text dimensions
    const width = measureElement.offsetWidth;
    const height = measureElement.offsetHeight;
    
    // Remove measurement element
    measureElement.remove();
    
    // Create the physics body (rectangle with text dimensions)
    const textBody = Bodies.rectangle(
        position.x,
        position.y,
        width,
        height,
        {
            restitution: defaultBounciness,
            friction: 0.2,
            frictionAir: 0.01,
            render: {
                fillStyle: getRandomColorFromTheme(),
                strokeStyle: 'rgba(255, 255, 255, 0.3)',
                lineWidth: 1
            }
        }
    );
    
    // Store the text content for rendering
    textBody.textContent = text;
    textBody.isTextObject = true;
    textBody.fontSize = 20;
    textBody.fontColor = '#FFFFFF';
    textBody.originalStrokeStyle = 'rgba(255, 255, 255, 0.3)';
    
    // Add to world
    Composite.add(engine.world, textBody);
    
    return textBody;
}
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
    
    // Listen for clicks on the canvas to place attractors
    canvas.addEventListener('click', function(event) {
        if (attractorMode) {
            createAttractor(event.clientX, event.clientY);
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
    // Set up our event listeners
    document.getElementById('add-circle').addEventListener('click', () => addCircle());
    document.getElementById('add-square').addEventListener('click', () => addSquare());
    document.getElementById('add-triangle').addEventListener('click', () => addTriangle());
    document.getElementById('add-star').addEventListener('click', () => addStar());
    document.getElementById('add-sand').addEventListener('click', () => {
        for (let i = 0; i < 20; i++) {
            addSandParticle();
        }
    });

    document.getElementById('toggle-wind').addEventListener('click', function() {
        windEnabled = !windEnabled;
        this.textContent = windEnabled ? 'Disable Wind' : 'Enable Wind';
    });

    document.getElementById('toggle-collision-sparks').addEventListener('click', function() {
        collisionEffectsEnabled = !collisionEffectsEnabled;
        this.textContent = collisionEffectsEnabled ? 'Disable Effects' : 'Collision Effects';
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

    document.getElementById('clear').addEventListener('click', clearNonStaticBodies);
    document.getElementById('save-state').addEventListener('click', savePlaygroundState);
    document.getElementById('load-state').addEventListener('click', loadPlaygroundState);

    // Close modal button
    document.querySelector('.close-modal').addEventListener('click', function() {
        document.getElementById('info-modal').style.display = 'none';
    });

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
    document.body.appendChild(particle);
    
    // Random direction
    const angle = Math.random() * Math.PI * 2;
    const velocity = {
        x: Math.cos(angle) * (1 + Math.random() * 2),
        y: Math.sin(angle) * (1 + Math.random() * 2) - 1 // Slight upward bias
    };
    
    // Initial position
    let x = position.x;
    let y = position.y;
    let opacity = 1;
    let currentSize = size;
    
    // Animate the particle
    function animateParticle() {
        x += velocity.x;
        y += velocity.y;
        velocity.y += 0.05; // Gravity
        opacity -= 0.05;
        currentSize *= 0.95;
        
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
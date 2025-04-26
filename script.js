// Define Matter.js modules without destructuring to avoid potential issues
let Engine, Render, Runner, Body, Bodies, Composite, Mouse, MouseConstraint, Events, Vector, Common, Vertices;

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
let doubleClickThreshold = 300; 
let isPaused = false;
let timeScale = 1.0; 
let collisionEffectType = 0; 
let explosionMode = false;
let portalMode = false; 
let portals = []; 

// Define allActionButtons early
const allActionButtons = [
    'add-circle', 'add-square', 'add-triangle', 'add-star', 'add-sand', 'add-text',
    'toggle-wind', 'add-attractor', 'toggle-collision-sparks', 'create-explosion',
    'add-portal', 'toggle-pause', 'add-gravity-zone'
];

// Theme definitions
let currentTheme = 'boutique'; 
const themes = {
    boutique: {
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

let boutiqueColors = themes.boutique;

// More globals
let attractors = [];
let attractorMode = false;
let windEnabled = false;
let windStrength = 0.1;
let defaultBounciness = 0.7;
let collisionEffectsEnabled = true;
let sandParticles = [];
let lastFrameTime = null;
let frameRateHistory = Array(30).fill(60);
let engine, render, runner, mouse, mouseConstraint, canvas;
let draggedBody = null;
let ground, leftWall, rightWall, ceiling, basePlatform;
let gravityZones = [];
let gravityZoneMode = false;
let glowElements = {
    portals: [],
    attractors: [],
    shapes: []
};

// Wait for DOM before initializing
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, initializing physics...");
    
    // First, make sure Matter.js is available
    if (typeof Matter === 'undefined') {
        console.error("ERROR: Matter.js library not found!");
        alert("Error: Physics engine failed to load. Please check your internet connection and refresh the page.");
        return;
    }
    
    try {
        // Assign all Matter.js modules
        Engine = Matter.Engine;
        Render = Matter.Render;
        Runner = Matter.Runner;
        Body = Matter.Body;
        Bodies = Matter.Bodies;
        Composite = Matter.Composite;
        Mouse = Matter.Mouse;
        MouseConstraint = Matter.MouseConstraint;
        Events = Matter.Events;
        Vector = Matter.Vector;
        Common = Matter.Common;
        Vertices = Matter.Vertices;
        
        console.log("Matter.js modules initialized");
        
        // Initialize physics engine
        initPhysics();
        console.log("Physics initialized");
        
        // Set up event listeners and UI
        setupEventListeners();
        initButtonsClasses();
        setupCursorAndTouchEvents();
        initMobileSupport();
        addDecorativeElements();
        console.log("UI setup complete");
        
        // Initial shapes
        setTimeout(function() {
            console.log("Adding initial shapes");
            for (let i = 0; i < 3; i++) {
                addCircle(window.innerWidth/2 - 100 + i*100, 100);
                addSquare(window.innerWidth/2 - 100 + i*100, 200);
            }
        }, 1000);
    } catch (error) {
        console.error("Initialization error:", error);
        alert("An error occurred during initialization: " + error.message);
    }
});

function initPhysics() {
    console.log("Initializing physics engine...");
    

    engine = Engine.create();
    engine.world.gravity.y = 1;
    engine.timing.timeScale = 0.9;
    
    // Set higher quality physics simulation
    engine.positionIterations = 12; 
    engine.velocityIterations = 8;  
    engine.enableSleeping = true;

    // Get canvas element
    canvas = document.getElementById('physics-canvas');
    
    // Set canvas dimensions
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Create renderer
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

    // Start engine and renderer
    runner = Runner.create();
    Runner.run(runner, engine);
    Render.run(render);

    // Set up mouse control
    setupMouseControl();
    
    // Create boundaries
    createBoundaries();
    
    // Setup collision events
    setupCollisionEvents();
    
    // Setup update loop
    setupUpdateLoop();
    
    console.log("Physics initialization complete");
}

// Function to clear active state from buttons
function clearActiveState(buttonIds) {
    buttonIds.forEach(id => {
        const button = document.getElementById(id);
        if (button) {
            button.classList.remove('active');
        }
    });
}

function setTheme(theme) {
    console.log("Setting theme to:", theme);
    
    // Make sure the theme exists, default to 'boutique' if it doesn't
    if (!themes[theme]) {
        console.warn("Invalid theme:", theme);
        theme = 'boutique';
    }
    
    // Update the theme colors for particles and effects
    boutiqueColors = themes[theme];
    
    // Remove all existing theme classes
    document.body.className = '';
    
    // Add the new theme class
    document.body.classList.add(theme + '-theme');
    console.log("Applied theme class:", theme + '-theme');
    
    // Update any active elements to match the new theme
    const activeButtons = document.querySelectorAll('button.active');
    activeButtons.forEach(button => {
        // Reset and re-apply active class to trigger CSS changes
        button.classList.remove('active');
        setTimeout(() => button.classList.add('active'), 10);
    });
    
    // Store the current theme
    currentTheme = theme;
    
    // Update the theme selector to match
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.value = theme;
    }
    
    // Show user feedback
    showFloatingMessage(`Theme changed to ${theme}`);
}

function addCircle(x, y) {
    const posX = x || window.innerWidth/2;
    const posY = y || 100;
    
    const radius = 20 + Math.random() * 30;
    const color = getRandomColorFromTheme();
    
    console.log(`Creating circle at (${posX}, ${posY})`);
    
    const circle = Bodies.circle(
        posX,
        posY,
        radius,
        {
            restitution: defaultBounciness,
            friction: 0.1,
            frictionStatic: 0.5,
            frictionAir: 0.001,
            density: 0.1,
            render: {
                fillStyle: color,
                strokeStyle: 'rgba(255, 255, 255, 0.3)',
                lineWidth: 1
            }
        }
    );
    
    circle.originalStrokeStyle = 'rgba(255, 255, 255, 0.3)';
    Composite.add(engine.world, circle);
    
    return circle;
}

function addSquare(x, y) {
    const posX = x || window.innerWidth/2;
    const posY = y || 100;
    
    const size = 20 + Math.random() * 40;
    const color = getRandomColorFromTheme();
    
    console.log(`Creating square at (${posX}, ${posY})`);
    
    const square = Bodies.rectangle(
        posX,
        posY,
        size,
        size,
        {
            restitution: defaultBounciness,
            friction: 0.1,
            frictionStatic: 0.5,
            frictionAir: 0.001,
            chamfer: { radius: 2 },
            render: {
                fillStyle: color,
                strokeStyle: 'rgba(255, 255, 255, 0.3)',
                lineWidth: 1
            }
        }
    );
    
    square.originalStrokeStyle = 'rgba(255, 255, 255, 0.3)';
    Composite.add(engine.world, square);
    
    return square;
}

function addTriangle(x, y) {
    const posX = x || window.innerWidth/2;
    const posY = y || 100;
    
    const size = 25 + Math.random() * 40;
    const height = size * Math.sqrt(3) / 2;
    const color = getRandomColorFromTheme();
    
    console.log(`Creating triangle at (${posX}, ${posY})`);
    
    const vertices = [
        { x: 0, y: -height / 2 },
        { x: -size / 2, y: height / 2 },
        { x: size / 2, y: height / 2 }
    ];
    
    const triangle = Bodies.fromVertices(
        posX,
        posY,
        [vertices],
        {
            restitution: defaultBounciness,
            friction: 0.1,
            frictionStatic: 0.5,
            frictionAir: 0.001,
            render: {
                fillStyle: color,
                strokeStyle: 'rgba(255, 255, 255, 0.3)',
                lineWidth: 1
            }
        }
    );
    
    triangle.originalStrokeStyle = 'rgba(255, 255, 255, 0.3)';
    Composite.add(engine.world, triangle);
    
    return triangle;
}

function addStar(x, y) {
    const posX = x || window.innerWidth/2;
    const posY = y || 100;
    
    const outerRadius = 25 + Math.random() * 20;
    const innerRadius = outerRadius * 0.4;
    const points = 5;
    const color = getRandomColorFromTheme();
    
    console.log(`Creating star at (${posX}, ${posY})`);
    
    const vertices = [];
    for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (Math.PI / points) * i;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        vertices.push({ x, y });
    }
    
    const star = Bodies.fromVertices(
        posX,
        posY,
        [vertices],
        {
            restitution: defaultBounciness,
            friction: 0.1,
            frictionStatic: 0.5,
            frictionAir: 0.001,
            render: {
                fillStyle: color,
                strokeStyle: 'rgba(255, 255, 255, 0.3)',
                lineWidth: 1
            }
        }
    );
    
    star.originalStrokeStyle = 'rgba(255, 255, 255, 0.3)';
    Composite.add(engine.world, star);
    
    return star;
}

function getRandomColorFromTheme() {
    const colors = boutiqueColors.sparkColors;
    return colors[Math.floor(Math.random() * colors.length)];
}

function createBoundaries() {
    console.log("Creating boundaries");
    
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
    
    Composite.add(engine.world, [ground, leftWall, rightWall, ceiling]);
}

function setupEventListeners() {
    console.log("Setting up event listeners");
    
    // Shape buttons
    const shapeButtons = ['add-circle', 'add-square', 'add-triangle', 'add-star', 'add-sand', 'add-text'];
    
    shapeButtons.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (!button) {
            console.warn(`Button #${buttonId} not found`);
            return;
        }
        
        button.addEventListener('click', () => {
            console.log(`Button clicked: ${buttonId}`);
            
            // Toggle active state
            if (button.classList.contains('active')) {
                button.classList.remove('active');
                return;
            }
            
            // Clear active state from all buttons
            clearActiveState(allActionButtons);
            
            // Activate this button
            button.classList.add('active');
            
            // Clear other modes
            attractorMode = false;
            explosionMode = false;
            gravityZoneMode = false;
            portalMode = false;
        });
    });
    
    // Theme selector
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.addEventListener('change', function() {
            console.log(`Theme selected: ${this.value}`);
            setTheme(this.value);
        });
    } else {
        console.warn("Theme selector not found");
    }
    
    // Canvas click handler for adding shapes
    canvas.addEventListener('click', function(event) {
        console.log(`Canvas clicked at (${event.clientX}, ${event.clientY})`);
        
        // Update mouse position
        lastMousePos.x = event.clientX;
        lastMousePos.y = event.clientY;
        
        const activeButtonId = document.querySelector('.shape-button.active')?.id;
        
        if (activeButtonId) {
            switch(activeButtonId) {
                case 'add-circle': 
                    addCircle(event.clientX, event.clientY); 
                    break;
                case 'add-square': 
                    addSquare(event.clientX, event.clientY); 
                    break;
                case 'add-triangle': 
                    addTriangle(event.clientX, event.clientY); 
                    break;
                case 'add-star': 
                    addStar(event.clientX, event.clientY); 
                    break;
            }
        }
    });
}

function setupMouseControl() {
    console.log("Setting up mouse control");
    
    mouse = Mouse.create(render.canvas);
    mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: {
            stiffness: 0.2,
            render: {
                visible: false
            }
        }
    });
    
    Composite.add(engine.world, mouseConstraint);
    
    // Ensure the mouse coordinates are properly mapped to the canvas
    render.mouse = mouse;
}

function setupCollisionEvents() {
    console.log("Setting up collision events");
    
    Events.on(engine, 'collisionStart', function(event) {
        const pairs = event.pairs;
        
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            
            if (pair.bodyA.isStatic || pair.bodyB.isStatic) continue;
          
            const velA = pair.bodyA.velocity;
            const velB = pair.bodyB.velocity;
            const relativeVelocity = Math.sqrt(
                Math.pow(velA.x - velB.x, 2) + 
                Math.pow(velA.y - velB.y, 2)
            );
            
            if (relativeVelocity < 3) continue;
            
            const collision = pair.collision;
            const pos = collision.supports && collision.supports[0] ? 
                collision.supports[0] : 
                { 
                    x: (pair.bodyA.position.x + pair.bodyB.position.x) / 2,
                    y: (pair.bodyA.position.y + pair.bodyB.position.y) / 2
                };
        }
    });
}

function setupUpdateLoop() {
    console.log("Setting up update loop");
    
    Events.on(engine, 'beforeUpdate', function() {
        const now = performance.now();
        
        if (lastFrameTime) {
            const fps = 1000 / (now - lastFrameTime);
            frameRateHistory.push(fps);
            frameRateHistory.shift();
        }
        lastFrameTime = now;
    });
}

function initButtonsClasses() {
    console.log("Initializing button classes");
   
    const shapeButtons = ['add-circle', 'add-square', 'add-triangle', 'add-star', 'add-sand', 'add-text'];
    shapeButtons.forEach(id => {
        const button = document.getElementById(id);
        if (button) {
            button.classList.add('shape-button');
        } else {
            console.warn(`Button #${id} not found`);
        }
    });
}

function showFloatingMessage(text) {
    console.log("Message:", text);
    
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
    
    setTimeout(() => {
        message.style.opacity = '0';
        message.style.transition = 'opacity 0.5s ease';
        setTimeout(() => message.remove(), 500);
    }, 1500);
}

// Simple function stubs for cursor follower functionality
function setupCursorAndTouchEvents() {
    console.log("Setting up cursor and touch events");
    
    const cursorFollower = document.createElement('div');
    cursorFollower.className = 'cursor-follower';
    document.body.appendChild(cursorFollower);
    
    document.addEventListener('mousemove', function(e) {
        cursorFollower.style.left = e.clientX + 'px';
        cursorFollower.style.top = e.clientY + 'px';
    });
}

function initMobileSupport() {
    console.log("Initializing mobile support");
}

function addDecorativeElements() {
    console.log("Adding decorative elements");
}
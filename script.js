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
    
    // Track dragged body
    Events.on(mouseConstraint, 'startdrag', function(event) {
        draggedBody = event.body;
        if (draggedBody) {
            draggedBody.render.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            draggedBody.render.lineWidth = 2;
        }
    });
    
    Events.on(mouseConstraint, 'enddrag', function(event) {
        if (draggedBody) {
            draggedBody.render.strokeStyle = draggedBody.originalStrokeStyle || 'rgba(255, 255, 255, 0.3)';
            draggedBody.render.lineWidth = 1;
            draggedBody = null;
        }
    });
    
    // Add to world
    Composite.add(engine.world, mouseConstraint);
    
    // Ensure mouse coordinates map properly
    render.mouse = mouse;
}

function setupCollisionEvents() {
    console.log("Setting up collision events");
    
    Events.on(engine, 'collisionStart', function(event) {
        if (!collisionEffectsEnabled) return;
        
        const pairs = event.pairs;
        
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            
            // Skip collisions with static bodies
            if (pair.bodyA.isStatic || pair.bodyB.isStatic) continue;
            
            // Calculate relative velocity
            const velA = pair.bodyA.velocity;
            const velB = pair.bodyB.velocity;
            const relativeVelocity = Math.sqrt(
                Math.pow(velA.x - velB.x, 2) + 
                Math.pow(velA.y - velB.y, 2)
            );
            
            // Skip low-energy collisions
            if (relativeVelocity < 3) continue;
            
            // Get collision position
            const collision = pair.collision;
            const pos = collision.supports && collision.supports[0] ? 
                collision.supports[0] : 
                { 
                    x: (pair.bodyA.position.x + pair.bodyB.position.x) / 2,
                    y: (pair.bodyA.position.y + pair.bodyB.position.y) / 2
                };
            
            // Create particles based on velocity
            const sparkCount = Math.min(10, Math.floor(relativeVelocity / 2));
            const sparkColor = getRandomColorFromTheme();
            
            for (let j = 0; j < sparkCount; j++) {
                createCollisionParticle(pos, relativeVelocity / 3, sparkColor);
            }
        }
    });
}

function setupUpdateLoop() {
    console.log("Setting up update loop");
    
    // Override the render function to add custom rendering
    const originalRender = render.render;
    render.render = function() {
        // Call the original render function
        originalRender.apply(this, arguments);
        
        // Add custom rendering
        const context = render.context;
        
        // Render portals with swirl effects
        if (typeof renderPortals === 'function') {
            renderPortals(context);
        }
        
        // Render any text objects
        const bodies = Composite.allBodies(engine.world);
        bodies.forEach(body => {
            if (body.isTextObject) {
                context.save();
                context.translate(body.position.x, body.position.y);
                context.rotate(body.angle);
                context.fillStyle = body.fontColor || '#FFFFFF';
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.font = `${body.fontSize || 20}px Arial, sans-serif`;
                context.fillText(body.textContent, 0, 0);
                context.restore();
            }
        });
    };
    
    // Set up before update event handler
    Events.on(engine, 'beforeUpdate', function() {
        const now = performance.now();
        
        // Skip updates if paused
        if (isPaused) return;
        
        // Calculate FPS
        if (lastFrameTime) {
            const fps = 1000 / (now - lastFrameTime);
            frameRateHistory.push(fps);
            frameRateHistory.shift();
        }
        lastFrameTime = now;
        
        // Check for teleportation through portals
        if (typeof checkPortalTeleportation === 'function') {
            checkPortalTeleportation();
        }
        
        // Apply wind forces if enabled
        if (windEnabled) {
            applyWind();
        }
        
        // Apply attractor forces
        if (attractors.length > 0) {
            applyAttractorForces();
        }
        
        // Apply gravity zone forces
        if (gravityZones.length > 0) {
            applyGravityZoneForces();
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
    
    // Fade out and remove
    setTimeout(() => {
        message.style.opacity = '0';
        message.style.transition = 'opacity 0.5s ease';
        setTimeout(() => message.remove(), 500);
    }, 1500);
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

// Simple function stubs for cursor follower functionality
function setupCursorAndTouchEvents() {
    console.log("Setting up cursor and touch events");
    
    const cursorFollower = document.createElement('div');
    cursorFollower.className = 'cursor-follower';
    document.body.appendChild(cursorFollower);
    
    document.addEventListener('mousemove', function(e) {
        cursorFollower.style.left = e.clientX + 'px';
        cursorFollower.style.top = e.clientY + 'px';
        
        // Update last mouse position
        lastMousePos.x = e.clientX;
        lastMousePos.y = e.clientY;
    });
    
    // Show/hide on click
    document.addEventListener('mousedown', function() {
        cursorFollower.classList.add('active');
    });
    
    document.addEventListener('mouseup', function() {
        setTimeout(() => {
            cursorFollower.classList.remove('active');
        }, 500);
    });
}

function initMobileSupport() {
    console.log("Initializing mobile support");
    
    // Check if the device is mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        // Add mobile-specific class
        document.body.classList.add('mobile');
        
        // Adjust physics parameters for mobile
        engine.timing.timeScale = 0.8;
    }
}

function addDecorativeElements() {
    console.log("Adding decorative elements");
    
    // Add a few decorative elements in the background
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
        element.style.pointerEvents = 'none';
        
        document.body.appendChild(element);
    }
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

// Function to clear active state from buttons
function clearActiveState(buttonIds) {
    buttonIds.forEach(id => {
        const button = document.getElementById(id);
        if (button) {
            button.classList.remove('active');
        }
    });
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

// Portal system variables
const PORTAL_RADIUS = 40;
const PORTAL_COOLDOWN = 500; // ms cooldown to prevent immediate re-teleportation
const PORTAL_PAIRS = [];
let pendingPortal = null; // Store first portal of a pair while waiting for second placement
let portalColors = {
    entrance: '#3498db', // Blue for entrance
    exit: '#e74c3c'      // Red for exit
};

// Handle portal placement
function handlePortalPlacement(event) {
    const x = event.clientX;
    const y = event.clientY;
    
    // Show floating message about portal placement
    if (!pendingPortal) {
        // First portal of a pair (entrance)
        pendingPortal = {
            type: 'entrance',
            position: { x, y },
            radius: PORTAL_RADIUS,
            color: portalColors.entrance,
            bodies: [] // Bodies that have recently teleported (to prevent loops)
        };
        
        createPortalVisual(pendingPortal);
        showFloatingMessage('Entrance portal created. Click again to place exit portal.');
    } else {
        // Second portal of a pair (exit)
        const exitPortal = {
            type: 'exit',
            position: { x, y },
            radius: PORTAL_RADIUS,
            color: portalColors.exit,
            bodies: [] // Bodies that have recently teleported (to prevent loops)
        };
        
        createPortalVisual(exitPortal);
        
        // Create the portal pair
        const portalPair = {
            entrance: pendingPortal,
            exit: exitPortal,
            active: true
        };
        
        PORTAL_PAIRS.push(portalPair);
        pendingPortal = null;
        
        showFloatingMessage('Portal pair created!');
    }
}

// Create visual representation of portal
function createPortalVisual(portal) {
    // Create portal DOM element
    const element = document.createElement('div');
    element.className = 'portal';
    element.style.position = 'absolute';
    element.style.left = portal.position.x + 'px';
    element.style.top = portal.position.y + 'px';
    element.style.width = portal.radius * 2 + 'px';
    element.style.height = portal.radius * 2 + 'px';
    element.style.borderRadius = '50%';
    element.style.transform = 'translate(-50%, -50%)';
    element.style.backgroundColor = 'transparent';
    element.style.border = `3px solid ${portal.color}`;
    element.style.boxShadow = `0 0 15px ${portal.color}, inset 0 0 15px ${portal.color}`;
    element.style.zIndex = '10';
    element.style.pointerEvents = 'none';
    
    // Add rotating animation
    element.style.animation = 'portal-rotate 8s linear infinite';
    
    // Add to document
    document.body.appendChild(element);
    
    // Store reference to DOM element
    portal.element = element;
    
    // Create glow effect
    createPortalGlow(portal);
    
    return element;
}

// Create glow effect for portal
function createPortalGlow(portal) {
    // Create radial gradient for portal
    const glow = document.createElement('div');
    glow.className = 'portal-glow';
    glow.style.position = 'absolute';
    glow.style.left = portal.position.x + 'px';
    glow.style.top = portal.position.y + 'px';
    glow.style.width = portal.radius * 3 + 'px';
    glow.style.height = portal.radius * 3 + 'px';
    glow.style.background = `radial-gradient(circle, ${portal.color}40 0%, ${portal.color}10 60%, transparent 70%)`;
    glow.style.borderRadius = '50%';
    glow.style.transform = 'translate(-50%, -50%)';
    glow.style.zIndex = '5';
    glow.style.pointerEvents = 'none';
    
    // Add pulsing animation
    glow.style.animation = 'portal-pulse 2s ease-in-out infinite alternate';
    
    // Add to document
    document.body.appendChild(glow);
    
    // Store reference to glow element
    portal.glowElement = glow;
}

// Check if any bodies should teleport through portals
function checkPortalTeleportation() {
    if (PORTAL_PAIRS.length === 0) return;
    
    const bodies = Composite.allBodies(engine.world).filter(body => !body.isStatic);
    
    PORTAL_PAIRS.forEach(pair => {
        if (!pair.active) return;
        
        const entrance = pair.entrance;
        const exit = pair.exit;
        
        bodies.forEach(body => {
            // Skip bodies that recently teleported through this portal pair
            if (entrance.bodies.includes(body.id) || exit.bodies.includes(body.id)) return;
            
            // Check if body is near entrance portal
            const distanceToEntrance = Math.sqrt(
                Math.pow(body.position.x - entrance.position.x, 2) + 
                Math.pow(body.position.y - entrance.position.y, 2)
            );
            
            if (distanceToEntrance < entrance.radius) {
                // Teleport body to exit portal
                
                // Calculate vector from entrance to body
                const entranceVector = {
                    x: body.position.x - entrance.position.x,
                    y: body.position.y - entrance.position.y
                };
                
                // Normalize direction vector
                const distance = Math.sqrt(entranceVector.x * entranceVector.x + entranceVector.y * entranceVector.y);
                const direction = {
                    x: entranceVector.x / distance,
                    y: entranceVector.y / distance
                };
                
                // Teleport to corresponding position at exit
                const newPosition = {
                    x: exit.position.x + direction.x * (exit.radius + 10),
                    y: exit.position.y + direction.y * (exit.radius + 10)
                };
                
                // Move body to new position
                Body.setPosition(body, newPosition);
                
                // Create teleport effect
                createTeleportEffect(body, entrance, exit);
                
                // Add to recently teleported list to prevent immediate re-teleportation
                entrance.bodies.push(body.id);
                exit.bodies.push(body.id);
                
                // Remove from list after cooldown
                setTimeout(() => {
                    entrance.bodies = entrance.bodies.filter(id => id !== body.id);
                    exit.bodies = exit.bodies.filter(id => id !== body.id);
                }, PORTAL_COOLDOWN);
            }
        });
    });
}

// Create visual effect for teleportation
function createTeleportEffect(body, fromPortal, toPortal) {
    // Create particles at both portals
    for (let i = 0; i < 10; i++) {
        // Entrance portal particles
        createPortalParticle(fromPortal.position, fromPortal.color);
        
        // Exit portal particles
        createPortalParticle(toPortal.position, toPortal.color);
    }
    
    // Flash portals
    flashPortal(fromPortal);
    flashPortal(toPortal);
}

// Create particle effect for portal
function createPortalParticle(position, color) {
    const particle = document.createElement('div');
    particle.className = 'portal-particle';
    particle.style.position = 'absolute';
    particle.style.left = position.x + 'px';
    particle.style.top = position.y + 'px';
    particle.style.width = '6px';
    particle.style.height = '6px';
    particle.style.backgroundColor = color;
    particle.style.borderRadius = '50%';
    particle.style.transform = 'translate(-50%, -50%)';
    particle.style.zIndex = '11';
    particle.style.pointerEvents = 'none';
    
    document.body.appendChild(particle);
    
    // Random direction
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 3;
    
    // Animate particle
    let x = position.x;
    let y = position.y;
    let opacity = 1;
    let size = 6;
    
    const animate = () => {
        x += Math.cos(angle) * speed;
        y += Math.sin(angle) * speed;
        opacity -= 0.05;
        size += 0.2;
        
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        particle.style.opacity = opacity;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        
        if (opacity > 0) {
            requestAnimationFrame(animate);
        } else {
            particle.remove();
        }
    };
    
    requestAnimationFrame(animate);
}

// Flash portal effect
function flashPortal(portal) {
    const originalBorder = portal.element.style.border;
    const originalShadow = portal.element.style.boxShadow;
    
    // Flash effect
    portal.element.style.border = `5px solid white`;
    portal.element.style.boxShadow = `0 0 30px white, inset 0 0 30px white`;
    
    // Return to normal
    setTimeout(() => {
        portal.element.style.border = originalBorder;
        portal.element.style.boxShadow = originalShadow;
    }, 200);
}

// Implement wind force effect
function applyWind() {
    const bodies = Composite.allBodies(engine.world);
    
    // Create a sinusoidal wind pattern
    const time = Date.now() / 1000;
    const windX = Math.sin(time * 0.3) * windStrength;
    
    bodies.forEach(body => {
        if (body.isStatic || body === draggedBody) return;
        
        // Wind is stronger at the top of the screen
        const heightFactor = 1 - (body.position.y / window.innerHeight);
        const force = {
            x: windX * heightFactor * body.area * 0.0005,
            y: 0
        };
        
        Body.applyForce(body, body.position, force);
    });
}

// Create attractor
function createAttractor(x, y) {
    console.log(`Creating attractor at (${x}, ${y})`);
    
    const strength = 0.1;
    const radius = 100;
    
    // Create the attractor object
    const attractor = {
        position: { x, y },
        strength: strength,
        radius: radius
    };
    
    // Add to attractors array
    attractors.push(attractor);
    
    // Create visual representation
    const element = document.createElement('div');
    element.className = 'attractor';
    element.style.width = (radius * 2) + 'px';
    element.style.height = (radius * 2) + 'px';
    element.style.left = x + 'px';
    element.style.top = y + 'px';
    element.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(element);
    
    // Store reference to DOM element
    attractor.element = element;
    
    // Add glow effect
    createAttractorGlow(attractor);
    
    showFloatingMessage('Attractor created! Double click to remove.');
    
    return attractor;
}

// Create glow effect for attractor
function createAttractorGlow(attractor) {
    const glow = document.createElement('div');
    glow.className = 'attractor-glow';
    glow.style.position = 'absolute';
    glow.style.left = attractor.position.x + 'px';
    glow.style.top = attractor.position.y + 'px';
    glow.style.width = attractor.radius * 3 + 'px';
    glow.style.height = attractor.radius * 3 + 'px';
    glow.style.background = `radial-gradient(circle, rgba(255,215,0,0.3) 0%, rgba(255,215,0,0.1) 60%, transparent 70%)`;
    glow.style.borderRadius = '50%';
    glow.style.transform = 'translate(-50%, -50%)';
    glow.style.zIndex = '5';
    glow.style.pointerEvents = 'none';
    glow.style.animation = 'attractor-pulse 2s ease-in-out infinite alternate';
    
    document.body.appendChild(glow);
    
    // Store reference to glow element
    attractor.glowElement = glow;
}

// Remove attractor
function removeAttractor(attractor) {
    const index = attractors.indexOf(attractor);
    if (index !== -1) {
        attractors.splice(index, 1);
    }
    
    // Remove DOM elements
    if (attractor.element && attractor.element.parentNode) {
        attractor.element.parentNode.removeChild(attractor.element);
    }
    
    if (attractor.glowElement && attractor.glowElement.parentNode) {
        attractor.glowElement.parentNode.removeChild(attractor.glowElement);
    }
    
    showFloatingMessage('Attractor removed');
}

// Apply attractor forces
function applyAttractorForces() {
    if (attractors.length === 0) return;
    
    const bodies = Composite.allBodies(engine.world);
    
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

// Setup event listeners for buttons and other UI elements
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
    
    // Wind toggle button
    const windButton = document.getElementById('toggle-wind');
    if (windButton) {
        windButton.addEventListener('click', function() {
            console.log("Wind button clicked");
            
            // Toggle wind state
            windEnabled = !windEnabled;
            this.textContent = windEnabled ? 'Disable Wind' : 'Toggle Wind';
            this.classList.toggle('active', windEnabled);
            
            showFloatingMessage(windEnabled ? 'Wind enabled' : 'Wind disabled');
        });
    }
    
    // Collision effects button
    const collisionEffectsButton = document.getElementById('toggle-collision-sparks');
    if (collisionEffectsButton) {
        collisionEffectsButton.addEventListener('click', function() {
            console.log("Collision effects button clicked");
            
            if (!collisionEffectsEnabled) {
                collisionEffectsEnabled = true;
            } else {
                collisionEffectType = (collisionEffectType + 1) % 5;
            }
            
            const effectNames = ['Classic Particles', 'Star Burst', 'Trails', 'Glow', 'Ripples'];
            this.textContent = `Effect: ${effectNames[collisionEffectType]}`;
            this.classList.toggle('active', collisionEffectsEnabled);
            
            showFloatingMessage(`Collision effect: ${effectNames[collisionEffectType]}`);
        });
    }
    
    // Attractor button
    const attractorButton = document.getElementById('add-attractor');
    if (attractorButton) {
        attractorButton.addEventListener('click', function() {
            console.log("Attractor button clicked");
            
            // Clear active state from all buttons except this one
            clearActiveState(allActionButtons.filter(id => id !== 'add-attractor'));
            
            // Toggle attractor mode
            attractorMode = !attractorMode;
            this.textContent = attractorMode ? 'Cancel Attractor' : 'Add Attractor';
            this.classList.toggle('active', attractorMode);
            
            // Clear other modes
            gravityZoneMode = false;
            explosionMode = false;
            portalMode = false;
            
            showFloatingMessage(attractorMode ? 'Click to place an attractor' : 'Attractor mode disabled');
        });
    }
    
    // Gravity zone button
    const gravityZoneButton = document.getElementById('add-gravity-zone');
    if (gravityZoneButton) {
        gravityZoneButton.addEventListener('click', function() {
            console.log("Gravity zone button clicked");
            
            // Clear active state from all buttons except this one
            clearActiveState(allActionButtons.filter(id => id !== 'add-gravity-zone'));
            
            // Toggle gravity zone mode
            gravityZoneMode = !gravityZoneMode;
            this.classList.toggle('active', gravityZoneMode);
            
            // Clear other modes
            attractorMode = false;
            explosionMode = false;
            portalMode = false;
            
            showFloatingMessage(gravityZoneMode ? 'Click to place a gravity zone' : 'Gravity zone mode disabled');
        });
    }
    
    // Explosion button
    const explosionButton = document.getElementById('create-explosion');
    if (explosionButton) {
        explosionButton.addEventListener('click', function() {
            console.log("Explosion button clicked");
            
            // Clear active state from all buttons except this one
            clearActiveState(allActionButtons.filter(id => id !== 'create-explosion'));
            
            // Toggle explosion mode
            explosionMode = !explosionMode;
            this.textContent = explosionMode ? 'Cancel Explosion' : 'Explosion';
            this.classList.toggle('active', explosionMode);
            
            // Clear other modes
            attractorMode = false;
            gravityZoneMode = false;
            portalMode = false;
            
            showFloatingMessage(explosionMode ? 'Click anywhere to create explosions' : 'Explosion mode disabled');
        });
    }
    
    // Pause button
    const pauseButton = document.getElementById('toggle-pause');
    if (pauseButton) {
        pauseButton.addEventListener('click', function() {
            togglePause();
            this.classList.toggle('active', isPaused);
        });
    }
    
    // Clear button
    const clearButton = document.getElementById('clear');
    if (clearButton) {
        clearButton.addEventListener('click', function() {
            clearNonStaticBodies();
            
            // Remove all attractors
            while (attractors.length > 0) {
                removeAttractor(attractors[0]);
            }
            
            // Remove all gravity zones
            while (gravityZones.length > 0) {
                removeGravityZone(gravityZones[0]);
            }
            
            // Clear all portals
            clearAllPortals();
            
            // Reset modes
            attractorMode = false;
            explosionMode = false;
            gravityZoneMode = false;
            portalMode = false;
            
            // Reset button states
            clearActiveState(allActionButtons);
            
            showFloatingMessage('All items cleared');
        });
    }
    
    // Portal button
    const portalButton = document.getElementById('add-portal');
    if (portalButton) {
        portalButton.addEventListener('click', function() {
            console.log("Portal button clicked");
            
            // Clear active state from all buttons except this one
            clearActiveState(allActionButtons.filter(id => id !== 'add-portal'));
            
            // Toggle portal mode
            portalMode = !portalMode;
            this.classList.toggle('active', portalMode);
            
            // Clear other modes
            attractorMode = false;
            explosionMode = false;
            gravityZoneMode = false;
            
            if (portalMode) {
                showFloatingMessage('Portal mode enabled. Click to place entrance portal, then exit portal.');
                // Reset pending portal if any
                pendingPortal = null;
            } else {
                showFloatingMessage('Portal mode disabled');
            }
        });
    }
    
    // Theme selector
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.addEventListener('change', function() {
            console.log(`Theme selected: ${this.value}`);
            setTheme(this.value);
        });
    }
    
    // Slider events
    const gravitySlider = document.getElementById('gravity-slider');
    if (gravitySlider) {
        gravitySlider.addEventListener('input', function() {
            engine.world.gravity.y = parseFloat(this.value);
            showFloatingMessage(`Gravity: ${this.value}`);
        });
    }
    
    const windSlider = document.getElementById('wind-slider');
    if (windSlider) {
        windSlider.addEventListener('input', function() {
            windStrength = parseFloat(this.value);
            showFloatingMessage(`Wind strength: ${this.value}`);
        });
    }
    
    const bounceSlider = document.getElementById('bounce-slider');
    if (bounceSlider) {
        bounceSlider.addEventListener('input', function() {
            defaultBounciness = parseFloat(this.value);
            showFloatingMessage(`Bounciness: ${this.value}`);
        });
    }
    
    const timeSlider = document.getElementById('time-slider');
    if (timeSlider) {
        timeSlider.addEventListener('input', function() {
            timeScale = parseFloat(this.value);
            engine.timing.timeScale = timeScale;
            
            const speedText = timeScale < 1 ? 'Slow Motion' : 
                              timeScale > 1 ? 'Fast Forward' : 'Normal Speed';
            showFloatingMessage(`Time: ${speedText} (${timeScale.toFixed(1)}x)`);
            
            if (timeScale < 0.5) {
                document.body.classList.add('slow-motion');
            } else {
                document.body.classList.remove('slow-motion');
            }
        });
    }
    
    // Canvas click handler for adding shapes and portals
    canvas.addEventListener('click', function(event) {
        console.log(`Canvas clicked at (${event.clientX}, ${event.clientY})`);
        
        // Update mouse position
        lastMousePos.x = event.clientX;
        lastMousePos.y = event.clientY;
        
        if (portalMode) {
            // Handle portal placement
            handlePortalPlacement(event);
            return;
        }
        
        if (attractorMode) {
            // Create attractor at click point
            createAttractor(event.clientX, event.clientY);
            return;
        }
        
        if (explosionMode) {
            // Create explosion at click point
            createExplosion({x: event.clientX, y: event.clientY});
            return;
        }
        
        if (gravityZoneMode) {
            // Create gravity zone at click point
            createGravityZone(event.clientX, event.clientY);
            return;
        }
        
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
                case 'add-sand':
                    for (let i = 0; i < 20; i++) {
                        setTimeout(() => {
                            addSandParticle(event.clientX + (Math.random() - 0.5) * 20, event.clientY + (Math.random() - 0.5) * 20);
                        }, i * 20);
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
    });
    
    // Double click to remove objects
    canvas.addEventListener('dblclick', function(event) {
        console.log(`Canvas double-clicked at (${event.clientX}, ${event.clientY})`);
        
        // Check if double click is near an attractor to remove it
        attractors.forEach(attractor => {
            const dx = event.clientX - attractor.position.x;
            const dy = event.clientY - attractor.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < attractor.radius) {
                removeAttractor(attractor);
            }
        });
        
        // Check if double click is near a gravity zone to remove it
        gravityZones.forEach(zone => {
            const dx = event.clientX - zone.position.x;
            const dy = event.clientY - zone.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < zone.radius) {
                removeGravityZone(zone);
            }
        });
    });
}

// Create gravity zone
function createGravityZone(x, y) {
    console.log(`Creating gravity zone at (${x}, ${y})`);
    
    const radius = 150;
    const strength = document.getElementById('gravity-slider').value * -0.5; // Inverse of current gravity
    
    // Create gravity zone object
    const gravityZone = {
        position: { x, y },
        strength: strength,
        radius: radius,
        pulsePhase: 0
    };
    
    // Create visual representation
    const element = document.createElement('div');
    element.className = 'gravity-zone';
    element.style.position = 'absolute';
    element.style.width = (radius * 2) + 'px';
    element.style.height = (radius * 2) + 'px';
    element.style.left = x + 'px';
    element.style.top = y + 'px';
    element.style.transform = 'translate(-50%, -50%)';
    element.style.background = strength > 0 ? 
        'radial-gradient(circle, rgba(100,200,255,0.15) 0%, rgba(50,100,255,0.1) 40%, rgba(0,30,100,0) 80%)' : 
        'radial-gradient(circle, rgba(255,100,100,0.15) 0%, rgba(255,50,50,0.1) 40%, rgba(100,0,0,0) 80%)';
    element.style.border = `2px dashed ${strength > 0 ? 'rgba(100,150,255,0.3)' : 'rgba(255,100,100,0.3)'}`;
    element.style.borderRadius = '50%';
    element.style.pointerEvents = 'none';
    element.style.animation = 'gravity-zone-pulse 3s ease-in-out infinite alternate';
    document.body.appendChild(element);
    
    // Store reference to DOM element
    gravityZone.element = element;
    
    // Add to gravity zones array
    gravityZones.push(gravityZone);
    
    showFloatingMessage(strength > 0 ? 'Pull gravity zone added' : 'Push gravity zone added');
    
    return gravityZone;
}

// Apply gravity zone forces
function applyGravityZoneForces() {
    if (gravityZones.length === 0) return;
    
    const bodies = Composite.allBodies(engine.world);
    const time = Date.now() / 1000;
    
    gravityZones.forEach(zone => {
        // Update pulse phase
        zone.pulsePhase += 0.05;
        if (zone.pulsePhase > Math.PI * 2) zone.pulsePhase -= Math.PI * 2;
        
        bodies.forEach(body => {
            if (body.isStatic) return;
            
            const dx = zone.position.x - body.position.x;
            const dy = zone.position.y - body.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < zone.radius) {
                // Apply vertical gravity modification
                const forceMagnitude = zone.strength * 0.001 * body.mass;
                
                Body.applyForce(body, body.position, {
                    x: 0,
                    y: forceMagnitude
                });
                
                // Apply slight pull toward center
                const centerPull = 0.0001 * zone.strength;
                Body.applyForce(body, body.position, {
                    x: dx * centerPull,
                    y: dy * centerPull
                });
            }
        });
    });
}

// Function to toggle pause state
function togglePause() {
    isPaused = !isPaused;
    
    if (isPaused) {
        Runner.stop(runner);
        
        // Add pause indicator
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
        Runner.start(runner, engine);
        
        // Remove pause indicator
        const pauseIndicator = document.getElementById('pause-indicator');
        if (pauseIndicator) {
            pauseIndicator.remove();
        }
    }
    
    showFloatingMessage(isPaused ? 'Paused' : 'Resumed');
}

// Function to clear non-static bodies
function clearNonStaticBodies() {
    const bodies = Composite.allBodies(engine.world);
    
    bodies.forEach(body => {
        if (!body.isStatic) {
            Composite.remove(engine.world, body);
        }
    });
    
    sandParticles = [];
}

// Clear button
const clearButton = document.getElementById('clear');
if (clearButton) {
    clearButton.addEventListener('click', function() {
        clearNonStaticBodies();
        
        // Remove all attractors
        while (attractors.length > 0) {
            removeAttractor(attractors[0]);
        }
        
        // Remove all gravity zones
        while (gravityZones.length > 0) {
            removeGravityZone(gravityZones[0]);
        }
        
        // Clear all portals
        clearAllPortals();
        
        // Reset modes
        attractorMode = false;
        explosionMode = false;
        gravityZoneMode = false;
        portalMode = false;
        
        // Reset button states
        clearActiveState(allActionButtons);
        
        showFloatingMessage('All items cleared');
    });
}

// Function to clear all portals
function clearAllPortals() {
    // Clear portals array
    while (portals.length > 0) {
        removePortal(portals[0]);
    }
    
    // Clear PORTAL_PAIRS array and their DOM elements
    while (PORTAL_PAIRS.length > 0) {
        const pair = PORTAL_PAIRS[0];
        
        // Remove entrance portal element
        if (pair.entrance && pair.entrance.element) {
            pair.entrance.element.remove();
        }
        
        // Remove entrance portal glow element
        if (pair.entrance && pair.entrance.glowElement) {
            pair.entrance.glowElement.remove();
        }
        
        // Remove exit portal element
        if (pair.exit && pair.exit.element) {
            pair.exit.element.remove();
        }
        
        // Remove exit portal glow element
        if (pair.exit && pair.exit.glowElement) {
            pair.exit.glowElement.remove();
        }
        
        PORTAL_PAIRS.splice(0, 1);
    }
    
    // Reset pending portal if any
    if (pendingPortal) {
        if (pendingPortal.element) {
            pendingPortal.element.remove();
        }
        if (pendingPortal.glowElement) {
            pendingPortal.glowElement.remove();
        }
        pendingPortal = null;
    }
}

// Function to remove a portal
function removePortal(portal) {
    const index = portals.indexOf(portal);
    if (index !== -1) {
        portals.splice(index, 1);
    }
    
    // Remove entrance portal
    if (portal.entranceElement && portal.entranceElement.parentNode) {
        portal.entranceElement.parentNode.removeChild(portal.entranceElement);
    }
    
    // Remove exit portal
    if (portal.exitElement && portal.exitElement.parentNode) {
        portal.exitElement.parentNode.removeChild(portal.exitElement);
    }
}
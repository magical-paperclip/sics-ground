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

// Global variables for the physics engine
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
let explosionMode = false; // Track if explosion mode is enabled
let portalMode = false; // Track if portal placement mode is enabled
let portals = []; // Array to store portal pairs

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
let ground, leftWall, rightWall, ceiling, basePlatform;

// Gravity zone variables
let gravityZones = [];
let gravityZoneMode = false;

// Track glowing elements
const glowElements = {
    portals: [],
    attractors: [],
    shapes: []
};

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
    
    // Gravity zone mode
    document.getElementById('add-gravity-zone').addEventListener('click', function() {
        toggleButtonMode('add-gravity-zone');
        gravityZoneMode = !gravityZoneMode;
        attractorMode = false; // Ensure other modes are off
        sandMode = false;
        
        if (gravityZoneMode) {
            showFloatingMessage('Click to place a gravity zone');
        }
    });
    
    // Portal Button
    document.getElementById('portalBtn').addEventListener('click', function() {
        portalMode = !portalMode;
        this.classList.toggle('active', portalMode);
        setCurrentMode('portal');
    });
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

    // set up mouse control
    setupMouseControl();
    

    createBoundaries();
    

    setupCollisionEvents();
    
 
    setupUpdateLoop();
}


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

    // light up the dragged body
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

    // add mouse constraint to the world
    Composite.add(engine.world, mouseConstraint);

    // ensure mouse events aren't interperted by the browser
    render.canvas.addEventListener('mousewheel', function(event) {
        event.preventDefault();
    });
    
    // listen for clicks on the canvas to place objects or attractors
    canvas.addEventListener('click', function(event) {
        // update mouse position
        lastMousePos.x = event.clientX;
        lastMousePos.y = event.clientY;
        
        if (attractorMode) {
            createAttractor(event.clientX, event.clientY);
        } else if (explosionMode) {
            // create explosion at click point when explosion mode is enabled
            createExplosion({x: event.clientX, y: event.clientY});
        } else if (gravityZoneMode) {
            createGravityZone(event.clientX, event.clientY);
        } else if (portalMode) {
            handlePortalPlacement(event);
        } else {

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
        
  
        const currentTime = new Date().getTime();
        if (currentTime - lastClickTime < doubleClickThreshold) {
      
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

document.addEventListener('mousemove', function(event) {
    lastMousePos = { x: event.clientX, y: event.clientY };
});


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


    const platformHeight = 20;
    const platformY = window.innerHeight - 100; // position 100px from bottom
    
    basePlatform = Bodies.rectangle(
        window.innerWidth / 2,
        platformY,
        window.innerWidth * 0.8, // 80% of screen width
        platformHeight,
        {
            isStatic: true,
            render: {
                fillStyle: 'rgba(255, 255, 255, 0.1)',
                strokeStyle: 'rgba(255, 255, 255, 0.6)',
                lineWidth: 2
            },
            chamfer: { radius: 10 }, 
            label: 'basePlatform'
        }
    );

    Composite.add(engine.world, [ground, leftWall, rightWall, ceiling, basePlatform]);
}


function setupEventListeners() {
    // All buttons that need to be tracked for active state
    const allActionButtons = [
        'add-circle', 'add-square', 'add-triangle', 'add-star', 
        'add-sand', 'add-text', 'add-gravity-zone', 'toggle-wind', 
        'add-attractor', 'toggle-collision-sparks', 'create-explosion',
        'add-portal', 'toggle-pause', 'clear'
    ];
    
    // Shape buttons (these should toggle as a group)
    const shapeButtons = ['add-circle', 'add-square', 'add-triangle', 'add-star', 'add-sand', 'add-text'];
    
    // Function to clear active state from specific button groups
    function clearActiveState(buttonGroup) {
        buttonGroup.forEach(id => {
            const button = document.getElementById(id);
            if (button) button.classList.remove('active');
        });
    }
    
    // Setup shape buttons
    shapeButtons.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (!button) return;
        
        button.classList.add('shape-button');
        
        button.addEventListener('click', () => {
            // If already active, deactivate it
            if (button.classList.contains('active')) {
                button.classList.remove('active');
                return;
            }
            
            // Clear active state from all buttons that should toggle
            clearActiveState(allActionButtons);
            
            // Activate this button
            button.classList.add('active');
            
            showFloatingMessage(`Now click anywhere on the canvas to add ${buttonId.replace('add-', '')}`);
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(event) {
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
                // Deactivate all buttons when pressing Escape
                clearActiveState(allActionButtons);
                // Reset all modes
                attractorMode = false;
                explosionMode = false;
                gravityZoneMode = false;
                portalMode = false;
                
                // Reset button texts
                document.getElementById('add-attractor').textContent = 'Add Attractor';
                document.getElementById('create-explosion').textContent = 'Explosion';
                break;
        }
    });

    // Mode toggle buttons
    
    // Wind toggle
    document.getElementById('toggle-wind').addEventListener('click', function() {
        // Clear other active buttons only if this one is becoming active
        if (!windEnabled) {
            clearActiveState(shapeButtons);
        }
        
        windEnabled = !windEnabled;
        this.textContent = windEnabled ? 'Disable Wind' : 'Toggle Wind';
        
        // Toggle active class based on state
        this.classList.toggle('active', windEnabled);
    });

    // Collision effects
    document.getElementById('toggle-collision-sparks').addEventListener('click', function() {
        if (!collisionEffectsEnabled) {
            collisionEffectsEnabled = true;
        } else {
            collisionEffectType = (collisionEffectType + 1) % 5;
        }
        
        const effectNames = ['Classic Particles', 'Star Burst', 'Trails', 'Glow', 'Ripples'];
        this.textContent = `Effect: ${effectNames[collisionEffectType]}`;
        showFloatingMessage(`Collision effect: ${effectNames[collisionEffectType]}`);
        
        // Set active class based on whether effects are enabled
        this.classList.toggle('active', collisionEffectsEnabled);
    });

    // Attractor mode
    document.getElementById('add-attractor').addEventListener('click', function() {
        // Clear active state from other buttons
        clearActiveState(allActionButtons.filter(id => id !== 'add-attractor'));
        
        // Toggle attractor mode
        attractorMode = !attractorMode;
        this.textContent = attractorMode ? 'Cancel Attractor' : 'Add Attractor';
        
        // Update active class to match state
        this.classList.toggle('active', attractorMode);
        
        // Show info modal for attractor mode
        if (attractorMode) {
            document.getElementById('info-modal').style.display = 'flex';
        }
        
        // Turn off other modes
        gravityZoneMode = false;
        explosionMode = false;
        portalMode = false;
    });
    
    // Modal close button
    document.querySelector('.close-modal').addEventListener('click', function() {
        document.getElementById('info-modal').style.display = 'none';
    });

    // Gravity zone button
    document.getElementById('add-gravity-zone').addEventListener('click', function() {
        // Clear other active buttons
        clearActiveState(allActionButtons.filter(id => id !== 'add-gravity-zone'));
        
        // Toggle gravity zone mode
        gravityZoneMode = !gravityZoneMode;
        this.classList.toggle('active', gravityZoneMode);
        
        // Reset other modes
        attractorMode = false;
        explosionMode = false;
        portalMode = false;
        
        if (gravityZoneMode) {
            showFloatingMessage('Click to place a gravity zone');
        }
    });

    // Portal button
    document.getElementById('add-portal').addEventListener('click', function() {
        // Clear other active buttons
        clearActiveState(allActionButtons.filter(id => id !== 'add-portal'));
        
        // Toggle portal mode
        portalMode = !portalMode;
        this.classList.toggle('active', portalMode);
        
        // Reset other modes
        attractorMode = false;
        gravityZoneMode = false;
        explosionMode = false;
        
        if (portalMode) {
            showFloatingMessage('Click to place portal pairs. First click creates entrance, second creates exit.');
        }
    });

    // Explosion button
    document.getElementById('create-explosion').addEventListener('click', function() {
        // Clear other active buttons
        clearActiveState(allActionButtons.filter(id => id !== 'create-explosion'));
        
        // Toggle explosion mode
        explosionMode = !explosionMode;
        this.textContent = explosionMode ? 'Cancel Explosion' : 'Explosion';
        this.classList.toggle('active', explosionMode);
        
        // Reset other modes
        attractorMode = false;
        gravityZoneMode = false;
        portalMode = false;
        
        // Show message about current state
        showFloatingMessage(explosionMode ? 'Explosion mode enabled - click anywhere to create explosions' : 'Explosion mode disabled');
    });
    
    // Pause button
    document.getElementById('toggle-pause').addEventListener('click', function() {
        // Toggle pause state
        togglePause();
        
        // Update active class to match state
        this.classList.toggle('active', isPaused);
    });
    
    // Clear button
    document.getElementById('clear').addEventListener('click', function() {
        // Clear all non-static bodies
        clearNonStaticBodies();
        
        // Clear all attractors
        while (attractors.length > 0) {
            removeAttractor(attractors[0]);
        }
        
        // Reset modes
        attractorMode = false;
        explosionMode = false;
        gravityZoneMode = false;
        portalMode = false;
        
        // Reset button texts
        document.getElementById('add-attractor').textContent = 'Add Attractor';
        document.getElementById('create-explosion').textContent = 'Explosion';
        document.getElementById('toggle-wind').textContent = 'Toggle Wind';
        
        // Deactivate all buttons
        clearActiveState(allActionButtons);
        
        showFloatingMessage('All cleared!');
    });

    // Theme selector
    document.getElementById('theme-select').addEventListener('change', function() {
        setTheme(this.value);
    });

    // Sliders
    document.getElementById('gravity-slider').addEventListener('input', function() {
        engine.world.gravity.y = parseFloat(this.value);
    });

    document.getElementById('wind-slider').addEventListener('input', function() {
        windStrength = parseFloat(this.value);
    });

    document.getElementById('bounce-slider').addEventListener('input', function() {
        defaultBounciness = parseFloat(this.value);
    });

    document.getElementById('time-slider').addEventListener('input', function() {
        timeScale = parseFloat(this.value);
        engine.timing.timeScale = timeScale;
        
        // Show visual feedback
        const speedText = timeScale < 1 ? 'Slow Motion' : 
                          timeScale > 1 ? 'Fast Forward' : 'Normal Speed';
        showFloatingMessage(`Time: ${speedText} (${timeScale.toFixed(1)}x)`);
        
        if (timeScale < 0.5) {
            document.body.classList.add('slow-motion');
        } else {
            document.body.classList.remove('slow-motion');
        }
    });

    // Save and load buttons
    document.getElementById('save-state').addEventListener('click', function() {
        savePlaygroundState();
    });
    
    document.getElementById('load-state').addEventListener('click', function() {
        loadPlaygroundState();
    });

    // Window resize handler
    window.addEventListener('resize', debounce(function() {
        render.options.width = window.innerWidth;
        render.options.height = window.innerHeight;
        render.canvas.width = window.innerWidth;
        render.canvas.height = window.innerHeight;
        
        // Adjust boundaries to match new window size
        Body.setPosition(ground, { x: window.innerWidth / 2, y: window.innerHeight });
        Body.setPosition(leftWall, { x: 0, y: window.innerHeight / 2 });
        Body.setPosition(rightWall, { x: window.innerWidth, y: window.innerHeight / 2 });
        Body.setPosition(ceiling, { x: window.innerWidth / 2, y: 0 });
        Body.setPosition(basePlatform, { x: window.innerWidth / 2, y: window.innerHeight - 100 });
        
        Body.setVertices(basePlatform, Bodies.rectangle(
            window.innerWidth / 2,
            window.innerHeight - 100,
            window.innerWidth * 0.8,
            20, 
            { chamfer: { radius: 10 } }
        ).vertices);
    }, 250));
}

function setupCollisionEvents() {
    Events.on(engine, 'collisionStart', function(event) {
        if (!collisionEffectsEnabled) return;
        
        const pairs = event.pairs;
        
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            
            // skip collisions with walls and static objects
            if (pair.bodyA.isStatic || pair.bodyB.isStatic) continue;
            
            // calculate collision velocity magnitude
            const velA = pair.bodyA.velocity;
            const velB = pair.bodyB.velocity;
            const relativeVelocity = Math.sqrt(
                Math.pow(velA.x - velB.x, 2) + 
                Math.pow(velA.y - velB.y, 2)
            );
            
            // skip low-energy collisions
            if (relativeVelocity < 3) continue;
            
            // calculate collision point
            const collision = pair.collision;
            const pos = collision.supports[0] || { 
                x: (pair.bodyA.position.x + pair.bodyB.position.x) / 2,
                y: (pair.bodyA.position.y + pair.bodyB.position.y) / 2
            };
            
            // create visual effect at collision point
            const sparkCount = Math.min(10, Math.floor(relativeVelocity / 2));
            
            // random color from theme
            const sparkColors = boutiqueColors.sparkColors;
            const sparkColor = sparkColors[Math.floor(Math.random() * sparkColors.length)];
            
            // create collision particles
            for (let j = 0; j < sparkCount; j++) {
                createCollisionParticle(pos, relativeVelocity / 2, sparkColor);
            }
        }
    });
}

// set up the main render/update loop
function setupUpdateLoop() {
    // override the standard render function to add text rendering
    const originalRender = render.render;
    render.render = function() {
        originalRender.apply(this, arguments);
        
        // get the rendering context
        const context = render.context;
        const bodies = Composite.allBodies(engine.world);
        
        context.font = '20px Arial, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // render text for text objects
        bodies.forEach(body => {
            if (body.isTextObject) {
                // save the current transform
                context.save();
                
                // translate + rotate to match the body
                context.translate(body.position.x, body.position.y);
                context.rotate(body.angle);
                
                // draw text
                context.fillStyle = body.fontColor || '#FFFFFF';
                context.fillText(body.textContent, 0, 0);
                
                // restore the transform
                context.restore();
            }
        });
        
        // render portals
        renderPortals(context);
    };

    Events.on(engine, 'beforeUpdate', function() {
        // track current time
        const now = performance.now();
        
        // calculate frame rate
        if (lastFrameTime) {
            const fps = 1000 / (now - lastFrameTime);
            frameRateHistory.push(fps);
            frameRateHistory.shift();
        }
        lastFrameTime = now;
        
        // apply wind if enabled
        if (windEnabled) {
            applyWind();
        }
        
        // apply attractor forces
        applyAttractorForces();
        
        // apply gravity zone forces
        applyGravityZoneForces();
        
        // check for portal teleportation
        checkPortalTeleportation();
        
        // clean up sand particles if there are too many (performance optimization)
        if (sandParticles.length > 500) {
            const toRemove = sandParticles.splice(0, 100);
            toRemove.forEach(particle => {
                Composite.remove(engine.world, particle);
            });
        }
        
        // Update all glow effects
        updateGlowEffects();
    });
}

// SHAPE CREATION FUNCTIONS
function addCircle() {
    const radius = 20 + Math.random() * 30;
    const color = getRandomColorFromTheme();
    const circle = Bodies.circle(
        lastMousePos.x,
        lastMousePos.y,
        radius,
        {
            restitution: defaultBounciness,
            friction: 0.1,
            frictionAir: 0.001,
            render: {
                fillStyle: color,
                strokeStyle: 'rgba(255, 255, 255, 0.3)',
                lineWidth: 1
            }
        }
    );
    
    circle.originalStrokeStyle = 'rgba(255, 255, 255, 0.3)';
    
    Composite.add(engine.world, circle);
    
    // Create subtle glow effect for the shape
    createGlowEffect('shape', {x: lastMousePos.x, y: lastMousePos.y}, radius, color);
    
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

// add decorative elements
function addDecorativeElements() {
    // create some decorative fixed elements
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

// helper to get random color from current theme
function getRandomColorFromTheme() {
    const colors = boutiqueColors.sparkColors;
    return colors[Math.floor(Math.random() * colors.length)];
}

// create and manage attractors
function createAttractor(x, y) {
    const strength = 0.1;
    const radius = 100;
    
    // create attractor object
    const attractor = {
        position: { x, y },
        strength: strength,
        radius: radius
    };
    
    // add to array :D
    attractors.push(attractor);
    
    // create visual element
    const element = document.createElement('div');
    element.className = 'attractor';
    element.style.width = (radius * 2) + 'px';
    element.style.height = (radius * 2) + 'px';
    element.style.left = (x - radius) + 'px';
    element.style.top = (y - radius) + 'px';
    document.body.appendChild(element);
    
    // reference the DOM element
    attractor.element = element;
    
    // Create glow effect for the attractor
    createGlowEffect('attractor', {x, y}, radius, null);
    
    return attractor;
}

function removeAttractor(attractor) {
    // remove from array
    const index = attractors.indexOf(attractor);
    if (index !== -1) {
        attractors.splice(index, 1);
    }
    
    // remove DOM element
    if (attractor.element && attractor.element.parentNode) {
        attractor.element.parentNode.removeChild(attractor.element);
    }
}

function applyAttractorForces() {
    if (attractors.length === 0) return;
    
    const bodies = Composite.allBodies(engine.world);
    
    // apply force from each attractor to each body
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

// create and manage gravity zones
function createGravityZone(x, y) {
    const radius = 150;
    const strength = document.getElementById('gravity-slider').value * -0.5; // Inverse of current gravity
    
    // create gravity zone object
    const gravityZone = {
        position: { x, y },
        strength: strength,
        radius: radius,
        pulsePhase: 0
    };
    
    // create visual element
    const element = document.createElement('div');
    element.className = 'gravity-zone';
    element.style.width = (radius * 2) + 'px';
    element.style.height = (radius * 2) + 'px';
    element.style.left = (x - radius) + 'px';
    element.style.top = (y - radius) + 'px';
    element.style.background = strength > 0 ? 
        'radial-gradient(circle, rgba(100,200,255,0.15) 0%, rgba(50,100,255,0.1) 40%, rgba(0,30,100,0) 80%)' : 
        'radial-gradient(circle, rgba(255,100,100,0.15) 0%, rgba(255,50,50,0.1) 40%, rgba(100,0,0,0) 80%)';
    element.style.border = `2px dashed ${strength > 0 ? 'rgba(100,150,255,0.3)' : 'rgba(255,100,100,0.3)'}`;
    document.body.appendChild(element);
    
    // reference the DOM element
    gravityZone.element = element;
    
    // add to array
    gravityZones.push(gravityZone);
    
    showFloatingMessage(strength > 0 ? 'Pull gravity zone added' : 'Push gravity zone added');
    
    return gravityZone;
}

function removeGravityZone(gravityZone) {
    // remove from array
    const index = gravityZones.indexOf(gravityZone);
    if (index !== -1) {
        gravityZones.splice(index, 1);
    }
    
    // remove DOM element
    if (gravityZone.element && gravityZone.element.parentNode) {
        gravityZone.element.parentNode.removeChild(gravityZone.element);
    }
}

function applyGravityZoneForces() {
    if (gravityZones.length === 0) return;
    
    const bodies = Composite.allBodies(engine.world);
    
    // update time for pulse effect
    const time = Date.now() / 1000;
    
    // apply force from each gravity zone to each body
    gravityZones.forEach(zone => {
        // update pulse phase
        zone.pulsePhase += 0.05;
        if (zone.pulsePhase > Math.PI * 2) zone.pulsePhase -= Math.PI * 2;
        
        // pulse effect for visualization
        const pulse = 1 + Math.sin(zone.pulsePhase) * 0.1;
        zone.element.style.transform = `translate(-50%, -50%) scale(${pulse})`;
        
        bodies.forEach(body => {
            if (body.isStatic) return;
            
            const dx = zone.position.x - body.position.x;
            const dy = zone.position.y - body.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < zone.radius) {
                // create a localized gravity effect
                const forceMagnitude = zone.strength * 0.001 * body.mass;
                
                Body.applyForce(body, body.position, {
                    x: 0,
                    y: forceMagnitude
                });
                
                // also add a slight pull toward center for more interesting effects
                const centerPull = 0.0001 * zone.strength;
                Body.applyForce(body, body.position, {
                    x: dx * centerPull,
                    y: dy * centerPull
                });
            }
        });
    });
}

// create particle for collision effects
function createCollisionParticle(position, size, color) {
    // different effect types based on current collisionEffectType
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
    particle.style.boxShadow = `0 0 ${size*2}px ${size}px ${color || '#fff'}`;
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
        particle.style.boxShadow = `0 0 ${currentSize*2}px ${currentSize}px ${color || '#fff'}`;
        
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
    ripple.style.zIndex = '9';
    ripple.style.pointerEvents = 'none';
    ripple.style.opacity = '0';
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

                Body.setVelocity(body, bodyData.velocity);
                Body.setAngularVelocity(body, bodyData.angularVelocity);
                Body.setAngle(body, bodyData.angle);
                
             
                Composite.add(engine.world, body);
            }
        });
    }
    
    
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


function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}


function setTheme(theme) {

    boutiqueColors = themes[theme];
    

    document.body.className = '';
    document.body.classList.add(theme + '-theme');
    

    currentTheme = theme;
}

// function to toggle pause state
function togglePause() {
    isPaused = !isPaused;
    
    if (isPaused) {

        Runner.stop(runner);
        
        
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
        // resume the simulation
        Runner.start(runner, engine);
        
        // remove pause indicator
        const pauseIndicator = document.getElementById('pause-indicator');
        if (pauseIndicator) {
            pauseIndicator.remove();
        }
    }
    
  
    showFloatingMessage(isPaused ? 'Paused (P to resume)' : 'Resumed');
}

// function showing temporary floating messages
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


function createExplosion(position, radius = 200, strength = 0.05) {

    const pos = {
        x: typeof position === 'object' && position.x !== undefined ? position.x : position,
        y: typeof position === 'object' && position.y !== undefined ? position.y : arguments[1]
    };

   
    if (typeof position !== 'object') {
        radius = arguments[2] || 200;
        strength = arguments[3] || 0.05;
    }

   
    const explosion = document.createElement('div');
    explosion.className = 'explosion';
    explosion.style.position = 'absolute';
    explosion.style.left = pos.x + 'px';
    explosion.style.top = pos.y + 'px';
    explosion.style.width = '0';
    explosion.style.height = '0';
    explosion.style.transform = 'translate(-50%, -50%)';
    explosion.style.background = 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,200,100,0.5) 40%, rgba(255,100,50,0) 70%)';
    explosion.style.borderRadius = '50%';
    explosion.style.zIndex = '10';
    explosion.style.pointerEvents = 'none';
    explosion.style.opacity = '0';
    document.body.appendChild(explosion);
    

    const centralGlow = document.createElement('div');
    centralGlow.style.position = 'absolute';
    centralGlow.style.left = pos.x + 'px';
    centralGlow.style.top = pos.y + 'px';
    centralGlow.style.width = '0';
    centralGlow.style.height = '0';
    centralGlow.style.background = 'rgba(255, 255, 255, 0.8)';
    centralGlow.style.borderRadius = '50%';
    centralGlow.style.transform = 'translate(-50%, -50%)';
    centralGlow.style.boxShadow = '0 0 30px 10px rgba(255, 220, 150, 0.8)';
    centralGlow.style.zIndex = '11';
    centralGlow.style.pointerEvents = 'none';
    centralGlow.style.opacity = '0';
    document.body.appendChild(centralGlow);
    

    let startTime;
    const duration = 600; 
    
    function animate(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        

        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentSize = radius * 2 * easeOutQuart;
        const centralSize = radius * 0.5 * easeOutQuart;
        

        const opacityProgress = progress < 0.3 ? progress / 0.3 : 1 - ((progress - 0.3) / 0.7);
        const opacity = Math.max(0, Math.min(1, opacityProgress));
        

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Clean up
            explosion.remove();
            centralGlow.remove();
        }
    }
    
    // Start animation
    requestAnimationFrame(animate);
    
    // Create shock wave ring with better animation
    const shockwave = document.createElement('div');
    shockwave.style.position = 'absolute';
    shockwave.style.left = pos.x + 'px';
    shockwave.style.top = pos.y + 'px';
    shockwave.style.width = '0';
    shockwave.style.height = '0';
    shockwave.style.borderRadius = '50%';
    shockwave.style.border = '4px solid rgba(255, 255, 255, 0.8)';
    shockwave.style.transform = 'translate(-50%, -50%)';
    shockwave.style.zIndex = '9';
    shockwave.style.pointerEvents = 'none';
    shockwave.style.opacity = '0';
    document.body.appendChild(shockwave);
    
    // Animate shockwave separately
    let shockwaveStart;
    const shockwaveDuration = 500; // ms
    
    function animateShockwave(timestamp) {
        if (!shockwaveStart) shockwaveStart = timestamp;
        const elapsed = timestamp - shockwaveStart;
        const progress = Math.min(elapsed / shockwaveDuration, 1);
        
        // Custom easing for smoother wave
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        const size = radius * 2 * easeOutCubic;
        const opacity = Math.max(0, 1 - easeOutCubic);
        const borderWidth = 4 - (3 * easeOutCubic);
        
        shockwave.style.width = size + 'px';
        shockwave.style.height = size + 'px';
        shockwave.style.opacity = opacity;
        shockwave.style.borderWidth = borderWidth + 'px';
        
        if (progress < 1) {
            requestAnimationFrame(animateShockwave);
        } else {
            shockwave.remove();
        }
    }
    
    requestAnimationFrame(animateShockwave);
    
    // Apply forces to nearby bodies with improved physics
    const bodies = Composite.allBodies(engine.world);
    
    // Stagger force application to reduce glitches
    setTimeout(() => {
        bodies.forEach(body => {
            if (body.isStatic) return;
            
            const dx = body.position.x - pos.x;
            const dy = body.position.y - pos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < radius) {
                // Calculate force with smoother falloff (cubic instead of linear)
                const normalizedDistance = distance / radius;
                const forceFactor = 1 - (normalizedDistance * normalizedDistance * normalizedDistance);
                
                // Apply force based on distance from center (stronger near center)
                const forceMagnitude = strength * forceFactor * body.mass;
                
                // Calculate direction with slight randomization to reduce uniform movement
                const angle = Math.atan2(dy, dx);
                const randomVariation = (Math.random() * 0.1) - 0.05; // ±5% variation
                
                // Apply force with dampened vertical component for more natural explosions
                Body.applyForce(body, body.position, {
                    x: Math.cos(angle + randomVariation) * forceMagnitude,
                    y: Math.sin(angle + randomVariation) * forceMagnitude * 0.85 // Slightly reduced vertical force
                });
                
                // Apply rotation based on distance from center (more natural)
                const rotationFactor = (1 - normalizedDistance) * 0.02;
                Body.setAngularVelocity(
                    body, 
                    body.angularVelocity + (Math.random() * 2 - 1) * rotationFactor
                );
            }
        });
    }, 10); // Small delay helps sync visual and physical effects
    
    // Create explosion particles with staggered timing
    const particleCount = isMobile() ? 15 : 30; // Fewer particles on mobile for performance
    
    for (let i = 0; i < particleCount; i++) {
        // Stagger particle creation for smoother effect
        setTimeout(() => {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * radius * 0.6;
            
            // Use different patterns based on particle index
            const particlePosition = {
                x: pos.x + Math.cos(angle) * distance * (i % 3 === 0 ? 0.5 : 1),
                y: pos.y + Math.sin(angle) * distance * (i % 3 === 0 ? 0.5 : 1)
            };
            
            // Vary particle size
            const particleSize = 4 + Math.random() * (i % 3 === 0 ? 8 : 4);
            
            // Create particle with varied appearance
            const effectType = i % 5; // Use different effect types for variety
            createCollisionParticle(particlePosition, particleSize, getRandomColorFromTheme());
        }, i * (isMobile() ? 40 : 20)); // Staggered timing based on device
    }
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
    
    // Get a random background color from the theme
    const backgroundColor = getRandomColorFromTheme();
    
    // Calculate a contrasting text color
    const textColor = getContrastingColor(backgroundColor);
    
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
                fillStyle: backgroundColor,
                strokeStyle: 'rgba(255, 255, 255, 0.3)',
                lineWidth: 1
            }
        }
    );
    
    // Store the text content for rendering
    textBody.textContent = text;
    textBody.isTextObject = true;
    textBody.fontSize = 20;
    textBody.fontColor = textColor;
    textBody.originalStrokeStyle = 'rgba(255, 255, 255, 0.3)';
    
    // Add to world
    Composite.add(engine.world, textBody);
    
    return textBody;
}

// Function to calculate a contrasting color for text based on background
function getContrastingColor(hexColor) {
    // Remove the # if it exists
    hexColor = hexColor.replace('#', '');
    
    // Convert hex to RGB
    let r = parseInt(hexColor.substr(0, 2), 16);
    let g = parseInt(hexColor.substr(2, 2), 16);
    let b = parseInt(hexColor.substr(4, 2), 16);
    
    // Calculate perceived brightness (using YIQ formula)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // Return black or white based on brightness
    return brightness > 128 ? '#000000' : '#FFFFFF';
}

// Add cursor follower element
function addCursorFollower() {
    const follower = document.createElement('div');
    follower.className = 'cursor-follower';
    document.body.appendChild(follower);
    return follower;
}

// Initialize cursor follower
let cursorFollower;
let isTouch = false;

// Setup touch and cursor events
function setupCursorAndTouchEvents() {
    cursorFollower = addCursorFollower();
    
    // Track if device is touch-enabled
    window.addEventListener('touchstart', function() {
        isTouch = true;
    }, { once: true });

    // Handle mouse movements
    document.addEventListener('mousemove', function(e) {
        if (isTouch) return; // Skip if touch device
        
        cursorFollower.style.left = e.clientX + 'px';
        cursorFollower.style.top = e.clientY + 'px';
    });
    
    // Handle touch movements for mobile
    document.addEventListener('touchmove', function(e) {
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            cursorFollower.style.left = touch.clientX + 'px';
            cursorFollower.style.top = touch.clientY + 'px';
        }
    });
    
    // Show cursor follower on click/touch
    document.addEventListener('mousedown', showCursorEffect);
    document.addEventListener('touchstart', showCursorEffect);
    
    // Hide cursor follower after delay
    document.addEventListener('mouseup', hideCursorEffectDelayed);
    document.addEventListener('touchend', hideCursorEffectDelayed);
}

// Show cursor effect
function showCursorEffect(e) {
    // Get position (handle both mouse and touch)
    const posX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : lastMousePos.x);
    const posY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : lastMousePos.y);
    
    // Update last mouse position
    lastMousePos.x = posX;
    lastMousePos.y = posY;
    
    // Update cursor follower
    cursorFollower.style.left = posX + 'px';
    cursorFollower.style.top = posY + 'px';
    cursorFollower.classList.add('active');
    
    // Make it bigger briefly
    cursorFollower.style.width = '50px';
    cursorFollower.style.height = '50px';
    
    // After a moment, reduce size but keep active
    setTimeout(() => {
        cursorFollower.style.width = '30px';
        cursorFollower.style.height = '30px';
    }, 150);
}

// Hide cursor effect with delay
function hideCursorEffectDelayed() {
    setTimeout(() => {
        cursorFollower.classList.remove('active');
    }, 1000);
}

// helper to determine if on a mobile device
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
}

// initialize touch handling for mobile
function initMobileSupport() {
    // add special handling for mobile devices
    if (isMobile()) {
        // make buttons larger on mobile
        document.querySelectorAll('.buttons button').forEach(button => {
            button.style.padding = '12px 16px';
            button.style.fontSize = '16px';
        });
        
        // add viewport meta tag if not present (should already be there)
        if (!document.querySelector('meta[name="viewport"]')) {
            const meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable
            document.head.appendChild(meta);
        }
        
        // better touch handling for the canvas
        canvas.addEventListener('touchstart', function(e) {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                lastMousePos.x = touch.clientX;
                lastMousePos.y = touch.clientY;
                
                // show the user where they touched
                showTouchIndicator(touch.clientX, touch.clientY);
            }
        });
        
        // handle mobile pinch-zoom
     ```javascript
        let lastDistance =```javascript
        let lastDistance = 0;
        canvas.addEventListener('touchmove', function(e) {
            e.preventDefault(); // Prevent scrolling while interacting with canvas
            
            if (e.touches.length >= 2) {
                // handle pinch zoom (can be used for future features)
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                
                const distance = Math.hypot(
                    touch1.clientX -touch2.clientX,
                    touch1.clientY - touch2.clientY
                );
                
                if (lastDistance > 0) {
                    const delta = distance - lastDistance;
                    // Could implement zoom or other features here
                }
                
                lastDistance = distance;
            } else if (e.touches.length === 1) {
                // update for single touch
                const touch =e.touches[0];
                lastMousePos.x = touch.clientX;
                lastMousePos.y = touch.clientY;
            }
        });
        
        canvas.addEventListener('touchend', function() {
            lastDistance = 0;
        });
    }
}

// Show visual indicator for touch
function showTouchIndicator(x, y) {
    const indicator = document.createElement('div');
    indicator.style.position = 'absolute';
    indicator.style.width = '40px';
    indicator.style.height = '40px';
    indicator.style.borderRadius = '50%';
    indicator.style.background = 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%)';
    indicator.style.left = x + 'px';
    indicator.style.top = y + 'px';
    indicator.style.transform = 'translate(-50%, -50%)';
    indicator.style.zIndex = '1000';
    indicator.style.pointerEvents = 'none';
    indicator.style.opacity = '0.8';
    document.body.appendChild(indicator);
    
    // Animate and remove
    indicator.animate([
        { transform: 'translate(-50%, -50%) scale(0.8)', opacity: 0.8 },
        { transform: 'translate(-50%, -50%) scale(1.5)', opacity: 0 }
    ], {
        duration: 400,
        easing: 'ease-out'
    }).onfinish = () => indicator.remove();
}

// Call the setup functions when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add our new setup functions to the initialization
    const originalInit = window.onload || function(){};
    window.onload = function() {
        if (typeof originalInit === 'function') originalInit();
        setupCursorAndTouchEvents();
        initMobileSupport();
    };
});

// Function to create a portal
function createPortal(x, y, isEntrance) {
    const portalColor = isEntrance ? '#3498db' : '#e74c3c'; // Blue for entrance, red for exit
    const portal = {
        x: x,
        y: y,
        radius: 30,
        isEntrance: isEntrance,
        color: portalColor,
        partner: null, // Will be linked to its partner portal
        particleTimer: 0
    };
    
    // If we have an odd number of portals, link the last two as a pair
    if (portals.length % 2 === 1) {
        const lastPortal = portals[portals.length - 1];
        portal.partner = lastPortal;
        lastPortal.partner = portal;
    }
    
    portals.push(portal);
    return portal;
}

// Function to handle portal placement
function handlePortalPlacement(event) {
    if (!portalMode) return;
    
    const canvas = document.getElementById('physics-canvas');
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Create entrance (odd index) or exit (even index) portal
    const isEntrance = portals.length % 2 === 0;
    const portal = createPortal(x, y, isEntrance);
    
    // Create glow effect for the portal
    createGlowEffect('portal', {x, y}, portal.radius, isEntrance ? 'entrance' : 'exit');
}

function renderPortals(context) {
    portals.forEach(portal => {
        
        context.beginPath();
        context.arc(portal.x, portal.y, portal.radius, 0, Math.PI * 2);
        context.fillStyle = portal.color;
        context.fill();
        
       
        context.beginPath();
        const time = Date.now() * 0.005;
        for (let i = 0; i < 3; i++) {
            const angle = time + i * Math.PI / 1.5;
            const radius = portal.radius * (0.8 - i * 0.2);
            const x = portal.x + Math.cos(angle) * radius * 0.5;
            const y = portal.y + Math.sin(angle) * radius * 0.5;
            
            if (i === 0) {
                context.moveTo(x, y);
            } else {
                context.lineTo(x, y);
            }
        }
        context.closePath();
        context.fillStyle = portal.isEntrance ? '#1e6fb8' : '#b83232';
        context.fill();
        
        
        portal.particleTimer += 1;
        if (portal.particleTimer > 5) {
            portal.particleTimer = 0;
           
        }
    });
}


function checkPortalTeleportation() {
    if (portals.length < 2) return;
    

    for (let i = 0; i < portals.length; i += 2) {
        if (i + 1 >= portals.length) continue;
        
        const entrancePortal = portals[i].isEntrance ? portals[i] : portals[i + 1];
        const exitPortal = portals[i].isEntrance ? portals[i + 1] : portals[i];
        
        if (!entrancePortal || !exitPortal) continue;
        
   
        const bodies = Composite.allBodies(engine.world);
        bodies.forEach(body => {
            if (body.isStatic) return;
            
            const dx = body.position.x - entrancePortal.x;
            const dy = body.position.y - entrancePortal.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < entrancePortal.radius + body.circleRadius) {
               
                const velX = body.velocity.x;
                const velY = body.velocity.y;
                const speed = Math.sqrt(velX * velX + velY * velY);
                
                
                Body.setPosition(body, {
                    x: exitPortal.x,
                    y: exitPortal.y
                });
                
                
                Body.setVelocity(body, {
                    x: velX * 1.1,
                    y: velY * 1.1
                });
                
                
                createExplosion(exitPortal.x, exitPortal.y, 10, exitPortal.color, 3);
            }
        });
    }
}

// Create a glow effect for an element
function createGlowEffect(element, type) {
    // Create a DOM element for the glow
    const glowElement = document.createElement('div');
    glowElement.className = `glow-effect ${type}-glow`;
    document.body.appendChild(glowElement);
    
    // Set initial styles based on type
    let color;
    switch(type) {
        case 'portal':
            color = element.pairId % 2 === 0 ? '#00aaff' : '#ff00aa';
            break;
        case 'attractor':
            color = element.isRepeller ? '#ff4444' : '#44ff44';
            break;
        case 'shape':
            // Different colors for different shapes
            const hue = (element.id * 137) % 360; // Golden ratio to distribute colors
            color = `hsl(${hue}, 70%, 60%)`;
            break;
    }
    
    // Set basic styles
    Object.assign(glowElement.style, {
        position: 'absolute',
        borderRadius: '50%',
        pointerEvents: 'none',
        background: `radial-gradient(circle, ${color}55 0%, ${color}00 70%)`,
        transform: 'translate(-50%, -50%)',
        zIndex: '-1',
        filter: 'blur(8px)'
    });
    
    // Create glow tracking object with random phase for varied animation
    const glowTracker = {
        element: glowElement,
        sourceElement: element,
        updated: true,
        pulsePhase: Math.random() * Math.PI * 2 // Random starting phase
    };
    
    // Add to the appropriate collection
    if (type === 'portal') {
        glowElements.portals.push(glowTracker);
    } else if (type === 'attractor') {
        glowElements.attractors.push(glowTracker);
    } else if (type === 'shape') {
        glowElements.shapes.push(glowTracker);
    }
    
    return glowTracker;
}

// Update glow positions and animations
function updateGlowEffects() {
    const currentTime = performance.now() / 1000;
    
    // Update portal glows
    glowElements.portals.forEach((glow, index) => {
        // Check if the portal still exists
        if (!glow.sourceElement || !glow.updated) {
            // Remove the glow effect if the portal was removed
            document.body.removeChild(glow.element);
            glowElements.portals.splice(index, 1);
            return;
        }
        
        // Update position to match the portal
        const x = glow.sourceElement.position.x;
        const y = glow.sourceElement.position.y;
        
        // Apply pulse effect
        const pulseScale = 1 + 0.15 * Math.sin(currentTime * 2 + glow.pulsePhase);
        const size = glow.sourceElement.circleRadius * 2.5 * pulseScale;
        
        // Update the DOM element
        glow.element.style.left = `${x}px`;
        glow.element.style.top = `${y}px`;
        glow.element.style.width = `${size}px`;
        glow.element.style.height = `${size}px`;
        
        // Reset the updated flag for the next frame
        glow.updated = false;
    });
    
    // Update attractor glows
    glowElements.attractors.forEach((glow, index) => {
        if (!glow.sourceElement || !glow.updated) {
            document.body.removeChild(glow.element);
            glowElements.attractors.splice(index, 1);
            return;
        }
        
        const x = glow.sourceElement.position.x;
        const y = glow.sourceElement.position.y;
        
        // Apply pulse effect for attractors
        const pulseScale = 1 + 0.2 * Math.sin(currentTime * 3 + glow.pulsePhase);
        const size = 80 * pulseScale;
        
        glow.element.style.left = `${x}px`;
        glow.element.style.top = `${y}px`;
        glow.element.style.width = `${size}px`;
        glow.element.style.height = `${size}px`;
        
        glow.updated = false;
    });
    
    // Update shape glows
    glowElements.shapes.forEach((glow, index) => {
        if (!glow.sourceElement || !glow.updated) {
            document.body.removeChild(glow.element);
            glowElements.shapes.splice(index, 1);
            return;
        }
        
        // For shapes, we need to compute the center of the bounds
        const bounds = glow.sourceElement.bounds;
        const x = (bounds.max.x + bounds.min.x) / 2;
        const y = (bounds.max.y + bounds.min.y) / 2;
        
        // Calculate the size based on the bounds
        const baseSize = Math.max(
            bounds.max.x - bounds.min.x,
            bounds.max.y - bounds.min.y
        ) * 1.3;
        
        // Apply subtle pulse effect for shapes
        const pulseScale = 1 + 0.1 * Math.sin(currentTime * 1.5 + glow.pulsePhase);
        const size = baseSize * pulseScale;
        
        glow.element.style.left = `${x}px`;
        glow.element.style.top = `${y}px`;
        glow.element.style.width = `${size}px`;
        glow.element.style.height = `${size}px`;
        
        glow.updated = false;
    });
}

// Remove any glow effects that weren't updated
function cleanupGlowEffects() {
    ['portal', 'attractor', 'shape'].forEach(type => {
        const collection = glowElements[`${type}s`];
        
        for (let i = collection.length - 1; i >= 0; i--) {
            if (!collection[i].updated) {
                // Remove the HTML element
                if (collection[i].element && collection[i].element.parentNode) {
                    collection[i].element.parentNode.removeChild(collection[i].element);
                }
                
                // Remove from collection
                collection.splice(i, 1);
            }
        }
    });
}
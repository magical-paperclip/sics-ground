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


const glowElements = {
    portals: [],
    attractors: [],
    shapes: []
};

document.addEventListener('DOMContentLoaded', function() {
    // Check if Matter.js is properly loaded
    if (typeof Matter === 'undefined') {
        console.error('Matter.js is not loaded! Please check the script inclusion.');
        alert('Error: Physics engine (Matter.js) failed to load. Please try refreshing the page.');
        return;
    }

    try {
        initPhysics();
        setupEventListeners();
        initButtonsClasses();
        addDecorativeElements();
        setupCursorAndTouchEvents();
        initMobileSupport();
        
        // Add some initial shapes
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                addCircle();
                addSquare();
                addTriangle();
                addStar();
            }, i * 200);
        }
    } catch (error) {
        console.error('Error initializing physics playground:', error);
        alert('An error occurred while initializing the physics playground. Check console for details.');
    }
});


function initButtonsClasses() {
   
    const shapeButtons = ['add-circle', 'add-square', 'add-triangle', 'add-star', 'add-sand', 'add-text'];
    shapeButtons.forEach(id => {
        const button = document.getElementById(id);
        if (button) {
            button.classList.add('shape-button');
        }
    });
}


function initPhysics() {
    
    engine = Engine.create();
    engine.world.gravity.y = 1;
    engine.timing.timeScale = 0.9;
    
  
    engine.positionIterations = 12; 
    engine.velocityIterations = 8;  
    engine.enableSleeping = true;


    canvas = document.getElementById('physics-canvas');
    
  
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
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

    // get things running
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
                            addSandParticle(event.clientX, event.clientY);
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
    const platformY = window.innerHeight - 100; 
    basePlatform = Bodies.rectangle(
        window.innerWidth / 2,
        platformY,
        window.innerWidth * 0.8,
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
    // shape buttons (these should toggle as a group)
    const shapeButtons = ['add-circle', 'add-square', 'add-triangle', 'add-star', 'add-sand', 'add-text'];
    
    // setup shape buttons
    shapeButtons.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (!button) return;
        
        button.classList.add('shape-button');
        
        button.addEventListener('click', () => {
            // toggle active state
            if (button.classList.contains('active')) {
                button.classList.remove('active');
                return;
            }
            
            // clear active state from all buttons
            clearActiveState(allActionButtons);
            
            // activate this button
            button.classList.add('active');
            
            // clear other modes
            attractorMode = false;
            explosionMode = false;
            gravityZoneMode = false;
            portalMode = false;
            
            // update user feedback
            showFloatingMessage(`Click anywhere on the canvas to add ${buttonId.replace('add-', '')}`);
        });
    });

    // keyboard shortcuts
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
            case ' ': // space key for explosion
                createExplosion(lastMousePos);
                break;
            case 'enter':
                document.getElementById('add-text').click();
                break;
            case 'escape':
                
                clearActiveState(allActionButtons);
                
                attractorMode = false;
                explosionMode = false;
                gravityZoneMode = false;
                portalMode = false;
                
                
                document.getElementById('add-attractor').textContent = 'Add Attractor';
                document.getElementById('create-explosion').textContent = 'Explosion';
                break;
        }
    });


    
    // wind toggle
    document.getElementById('toggle-wind').addEventListener('click', function() {
      
        if (!windEnabled) {
            clearActiveState(shapeButtons);
        }
        
        windEnabled = !windEnabled;
        this.textContent = windEnabled ? 'Disable Wind' : 'Toggle Wind';
        
       
        this.classList.toggle('active', windEnabled);
    });


    document.getElementById('toggle-collision-sparks').addEventListener('click', function() {
        if (!collisionEffectsEnabled) {
            collisionEffectsEnabled = true;
        } else {
            collisionEffectType = (collisionEffectType + 1) % 5;
        }
        
        const effectNames = ['Classic Particles', 'Star Burst', 'Trails', 'Glow', 'Ripples'];
        this.textContent = `Effect: ${effectNames[collisionEffectType]}`;
        showFloatingMessage(`Collision effect: ${effectNames[collisionEffectType]}`);
        
    
        this.classList.toggle('active', collisionEffectsEnabled);
    });


    document.getElementById('add-attractor').addEventListener('click', function() {
        
        clearActiveState(allActionButtons.filter(id => id !== 'add-attractor'));
        
        
        attractorMode = !attractorMode;
        this.textContent = attractorMode ? 'Cancel Attractor' : 'Add Attractor';
        
        
        this.classList.toggle('active', attractorMode);
        
        
        if (attractorMode) {
            const modal = document.getElementById('info-modal');
            modal.classList.add('active');
        }
        
       
        gravityZoneMode = false;
        explosionMode = false;
        portalMode = false;
    });
    
    
    document.querySelector('.close-modal').addEventListener('click', function() {
        document.getElementById('info-modal').classList.remove('active');
    });

    
    document.getElementById('add-gravity-zone').addEventListener('click', function() {
        
        clearActiveState(allActionButtons.filter(id => id !== 'add-gravity-zone'));
        
        
        gravityZoneMode = !gravityZoneMode;
        this.classList.toggle('active', gravityZoneMode);
        
       
        attractorMode = false;
        explosionMode = false;
        portalMode = false;
        
        if (gravityZoneMode) {
            showFloatingMessage('Click to place a gravity zone');
        }
    });

    
    document.getElementById('add-portal').addEventListener('click', function() {
        clearActiveState(allActionButtons.filter(id => id !== 'add-portal'));
        
        portalMode = !portalMode;
        this.classList.toggle('active', portalMode);
        
        attractorMode = false;
        gravityZoneMode = false;
        explosionMode = false;
        
        if (portalMode) {
            showFloatingMessage('Click to place portal pairs. First click creates entrance, second creates exit.');
        }
    });

    
    document.getElementById('create-explosion').addEventListener('click', function() {
       
        clearActiveState(allActionButtons.filter(id => id !== 'create-explosion'));
        


        explosionMode = !explosionMode;
        this.textContent = explosionMode ? 'Cancel Explosion' : 'Explosion';
        this.classList.toggle('active', explosionMode);
        

        attractorMode = false;
        gravityZoneMode = false;
        portalMode = false;
        

        showFloatingMessage(explosionMode ? 'Explosion mode enabled - click anywhere to create explosions' : 'Explosion mode disabled');
    });
    
   
    document.getElementById('toggle-pause').addEventListener('click', function() {
        
        togglePause();
        
        
        this.classList.toggle('active', isPaused);
    });
    
    
    document.getElementById('clear').addEventListener('click', function() {
       
        clearNonStaticBodies();
        
        
        while (attractors.length > 0) {
            removeAttractor(attractors[0]);
        }
        
        
        attractorMode = false;
        explosionMode = false;
        gravityZoneMode = false;
        portalMode = false;
        
        
        document.getElementById('add-attractor').textContent = 'Add Attractor';
        document.getElementById('create-explosion').textContent = 'Explosion';
        document.getElementById('toggle-wind').textContent = 'Toggle Wind';
        
      
        clearActiveState(allActionButtons);
        
        showFloatingMessage('All cleared!');
    });

   
    document.getElementById('theme-select').addEventListener('change', function() {
        setTheme(this.value);
    });

   
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
        
      
        const speedText = timeScale < 1 ? 'Slow Motion' : 
                          timeScale > 1 ? 'Fast Forward' : 'Normal Speed';
        showFloatingMessage(`Time: ${speedText} (${timeScale.toFixed(1)}x)`);
        
        if (timeScale < 0.5) {
            document.body.classList.add('slow-motion');
        } else {
            document.body.classList.remove('slow-motion');
        }
    });

   
    document.getElementById('save-state').addEventListener('click', function() {
        savePlaygroundState();
    });
    
    document.getElementById('load-state').addEventListener('click', function() {
        loadPlaygroundState();
    });

   
    window.addEventListener('resize', debounce(function() {
        render.options.width = window.innerWidth;
        render.options.height = window.innerHeight;
        render.canvas.width = window.innerWidth;
        render.canvas.height = window.innerHeight;
        

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
            
        
            if (pair.bodyA.isStatic || pair.bodyB.isStatic) continue;
          
            const velA = pair.bodyA.velocity;
            const velB = pair.bodyB.velocity;
            const relativeVelocity = Math.sqrt(
                Math.pow(velA.x - velB.x, 2) + 
                Math.pow(velA.y - velB.y, 2)
            );
            
          
            if (relativeVelocity < 3) continue;
            
        
            const collision = pair.collision;
            const pos = collision.supports[0] || { 
                x: (pair.bodyA.position.x + pair.bodyB.position.x) / 2,
                y: (pair.bodyA.position.y + pair.bodyB.position.y) / 2
            };
            
           
            const sparkCount = Math.min(10, Math.floor(relativeVelocity / 2));
            
     
            const sparkColors = boutiqueColors.sparkColors;
            const sparkColor = sparkColors[Math.floor(Math.random() * sparkColors.length)];
            
    
            for (let j = 0; j < sparkCount; j++) {
                createCollisionParticle(pos, relativeVelocity / 2, sparkColor);
            }
        }
    });
}


function setupUpdateLoop() {
   
    const originalRender = render.render;
    render.render = function() {
        originalRender.apply(this, arguments);
        

        const context = render.context;
        const bodies = Composite.allBodies(engine.world);
        
        context.font = '20px Arial, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
      
        bodies.forEach(body => {
            if (body.isTextObject) {

                context.save();
                
               
                context.translate(body.position.x, body.position.y);
                context.rotate(body.angle);
                

                context.fillStyle = body.fontColor || '#FFFFFF';
                context.fillText(body.textContent, 0, 0);
                

                context.restore();
            }
        });
        

        renderPortals(context);
    };

    Events.on(engine, 'beforeUpdate', function() {

        const now = performance.now();
        

        if (lastFrameTime) {
            const fps = 1000 / (now - lastFrameTime);
            frameRateHistory.push(fps);
            frameRateHistory.shift();
        }
        lastFrameTime = now;
        

        if (windEnabled) {
            applyWind();
        }
        

        applyAttractorForces();
        

        applyGravityZoneForces();
        

        checkPortalTeleportation();
        

        if (sandParticles.length > 500) {
            const toRemove = sandParticles.splice(0, 100);
            toRemove.forEach(particle => {
                Composite.remove(engine.world, particle);
            });
        }
        

        updateGlowEffects(now);
    });
}

function addCircle(x, y) {
    
    const posX = x || lastMousePos.x;
    const posY = y || lastMousePos.y;
    
    const radius = 20 + Math.random() * 30;
    const color = getRandomColorFromTheme();
    
    
    const circle = Bodies.circle(
        posX,
        posY,
        radius,
        {
            restitution: 0.9,           
            friction: 0.1,
            frictionStatic: 0.5,        
            frictionAir: 0.001,
            slop: 0.01,                
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
    

    createGlowEffect('shape', circle, { size: radius });
    
    return circle;
}

function addSquare(x, y) {
 
    const posX = x || lastMousePos.x;
    const posY = y || lastMousePos.y;
    
    const size = 20 + Math.random() * 40;
    const square = Bodies.rectangle(
        posX,
        posY,
        size,
        size,
        {
            restitution: 0.9,           
            friction: 0.1,
            frictionStatic: 0.5,        
            frictionAir: 0.001,
            slop: 0.01,                 
            density: 0.1,               
            chamfer: { radius: 2 },     
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

function addTriangle(x, y) {
    
    const posX = x || lastMousePos.x;
    const posY = y || lastMousePos.y;
    
    const size = 25 + Math.random() * 40;
    const height = size * Math.sqrt(3) / 2;
    
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
            restitution: 0.9,           
            friction: 0.1,
            frictionStatic: 0.5,        
            frictionAir: 0.001,
            slop: 0.01,                 
            density: 0.1,               
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

function addStar(x, y) {
    
    const posX = x || lastMousePos.x;
    const posY = y || lastMousePos.y;
    
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
        posX,
        posY,
        [vertices],
        {
            restitution: 0.9,           
            friction: 0.1,
            frictionStatic: 0.5,        
            frictionAir: 0.001,
            slop: 0.01,                 
            density: 0.1,               
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

function addSandParticle(x, y) {

    const posX = x || lastMousePos.x;
    const posY = y || lastMousePos.y;
    
    const size = 5 + Math.random() * 5;
    const particleX = posX + (Math.random() - 0.5) * 30;
    const particleY = posY + (Math.random() - 0.5) * 30;
    
    const particle = Bodies.circle(
        particleX, particleY, size,
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
    

    Composite.add(engine.world, particle);
    sandParticles.push(particle);
    
    return particle;
}


function addDecorativeElements() {

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

function getRandomColorFromTheme() {
    const colors = boutiqueColors.sparkColors;
    return colors[Math.floor(Math.random() * colors.length)];
}


function createAttractor(x, y) {
    const strength = 0.1;
    const radius = 100;
    

    const attractor = {
        position: { x, y },
        strength: strength,
        radius: radius
    };
    

    attractors.push(attractor);
    

    const element = document.createElement('div');
    element.className = 'attractor';
    element.style.width = (radius * 2) + 'px';
    element.style.height = (radius * 2) + 'px';
    element.style.left = (x - radius) + 'px';
    element.style.top = (y - radius) + 'px';
    document.body.appendChild(element);
    

    attractor.element = element;
    

    createGlowEffect('attractor', attractor, { size: radius });
    
    return attractor;
}

function removeAttractor(attractor) {

    const index = attractors.indexOf(attractor);
    if (index !== -1) {
        attractors.splice(index, 1);
    }
    

    if (attractor.element && attractor.element.parentNode) {
        attractor.element.parentNode.removeChild(attractor.element);
    }
}

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


function createGravityZone(x, y) {
    const radius = 150;
    const strength = document.getElementById('gravity-slider').value * -0.5; // Inverse of current gravity
    

    const gravityZone = {
        position: { x, y },
        strength: strength,
        radius: radius,
        pulsePhase: 0
    };
    

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
    document.body.appendChild(element);
    

    gravityZone.element = element;
    

    gravityZones.push(gravityZone);
    
    showFloatingMessage(strength > 0 ? 'Pull gravity zone added' : 'Push gravity zone added');
    
    return gravityZone;
}

function removeGravityZone(gravityZone) {

    const index = gravityZones.indexOf(gravityZone);
    if (index !== -1) {
        gravityZones.splice(index, 1);
    }
    

    if (gravityZone.element && gravityZone.element.parentNode) {
        gravityZone.element.parentNode.removeChild(gravityZone.element);
    }
}

function applyGravityZoneForces() {
    if (gravityZones.length === 0) return;
    
    const bodies = Composite.allBodies(engine.world);
    

    const time = Date.now() / 1000;
    

    gravityZones.forEach(zone => {

        zone.pulsePhase += 0.05;
        if (zone.pulsePhase > Math.PI * 2) zone.pulsePhase -= Math.PI * 2;
        

        const pulse = 1 + Math.sin(zone.pulsePhase) * 0.1;
        zone.element.style.transform = `translate(-50%, -50%) scale(${pulse})`;
        
        bodies.forEach(body => {
            if (body.isStatic) return;
            
            const dx = zone.position.x - body.position.x;
            const dy = zone.position.y - body.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < zone.radius) {

                const forceMagnitude = zone.strength * 0.001 * body.mass;
                
               
                Body.applyForce(body, body.position, {
                    x: 0,
                    y: forceMagnitude
                });
                

                const centerPull = 0.0001 * zone.strength;
                Body.applyForce(body, body.position, {
                    x: dx * centerPull,
                    y: dy * centerPull
                });
            }
        });
    });
}


function createCollisionParticle(position, size, color) {

    switch (collisionEffectType) {
        case 0: 
            createCircleParticle(position, size, color);
            break;
        case 1: 
            createStarBurstParticle(position, size, color);
            break;
        case 2: 
            createTrailParticle(position, size, color);
            break;
        case 3: 
            createGlowParticle(position, size, color);
            break;
        case 4: 
            createRippleEffect(position, size, color);
            break;
    }
}


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
    

    const angle = Math.random() * Math.PI * 2;
    const velocity = {
        x: Math.cos(angle) * (0.5 + Math.random() * 1.5),
        y: Math.sin(angle) * (0.5 + Math.random() * 1.5) - 0.8 
    };
    

    let x = position.x;
    let y = position.y;
    let opacity = 1;
    let currentSize = size;
    

    function animateParticle() {
        x += velocity.x;
        y += velocity.y;
        velocity.y += 0.025; 
        opacity -= 0.02; 
        currentSize *= 0.98; 
        
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
    
 
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 1.5; 
    const velocity = {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed - 0.5 
    };
    

    let x = position.x;
    let y = position.y;
    let opacity = 1;
    let currentSize = size;
    let rotation = 0;
    

    function animateParticle() {
        x += velocity.x;
        y += velocity.y;
        velocity.y += 0.02; 
        opacity -= 0.015; 
        currentSize *= 1.005;
        rotation += 2;
        
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


function createTrailParticle(position, size, color) {

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
            
            
            const baseAngle = Math.random() * Math.PI * 2;
            const curveFactor = Math.random() * 0.05 - 0.025;
            let curX = position.x;
            let curY = position.y;
            let t = 0;
            let opacity = 0.7;
            let prevTime = performance.now();
            
            function animateTrail() {
                const now = performance.now();
                const deltaTime = Math.min(30, now - prevTime) / 16.67; 
                prevTime = now;
                
                t += 0.03 * deltaTime; 
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
        }, i * 70); 
    }
}


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
    
 
    
    let prevTime = performance.now();
    
    const angle = Math.random() * Math.PI * 2;
    const velocity = {
        x: Math.cos(angle) * (0.3 + Math.random() * 0.7),
        y: Math.sin(angle) * (0.3 + Math.random() * 0.7) - 0.3
    };
    

    let x = position.x;
    let y = position.y;
    let opacity = 1;
    let currentSize = size;
    
   
    function animateParticle() {
        const now = performance.now();
        const deltaTime = Math.min(30, now - prevTime) / 16.67; 
        prevTime = now;
        
        x += velocity.x * deltaTime;
        y += velocity.y * deltaTime;
        velocity.y += 0.01 * deltaTime; 
        opacity -= 0.01 * deltaTime;
        currentSize *= (1 + 0.01 * deltaTime); 
        
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
    
   
    let prevTime = performance.now();
    let currentSize = size;
    let opacity = 1;
    
    function animateRipple() {
        const now = performance.now();
        const deltaTime = Math.min(30, now - prevTime) / 16.67; 
        prevTime = now;
        
  
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


function applyWind() {
    const bodies = Composite.allBodies(engine.world);
    
   
    const time = Date.now() / 1000;
    const windX = Math.sin(time * 0.3) * windStrength;
    
    bodies.forEach(body => {
        if (body.isStatic || body === draggedBody) return;
        

        const heightFactor = 1 - (body.position.y / window.innerHeight);
        const force = {
            x: windX * heightFactor * body.area * 0.0005,
            y: 0
        };
        
        Body.applyForce(body, body.position, force);
    });
}


function savePlaygroundState() {
    const bodies = Composite.allBodies(engine.world).filter(body => !body.isStatic);
    const saveData = {
        bodies: bodies.map(body => ({
            position: body.position,
            velocity: body.velocity,
            angularVelocity: body.angularVelocity,
            angle: body.angle,
          
            type: body.vertices.length === 8 ? 'star' :
                  body.vertices.length === 3 ? 'triangle' :
                  body.vertices.length === 4 ? 'square' : 'circle',
            
            size: body.type === 'circle' ? body.circleRadius :
                 Math.abs(body.vertices[0].x - body.vertices[2].x) / 2,
          
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
    

    clearNonStaticBodies();
    
    
    attractors.forEach(a => {
        if (a.element && a.element.parentNode) {
            a.element.parentNode.removeChild(a.element);
        }
    });
    attractors = [];
    

    if (state.settings) {
        engine.world.gravity.y = state.settings.gravity || 1;
        document.getElementById('gravity-slider').value = engine.world.gravity.y;
        
        windEnabled = state.settings.windEnabled || false;
        document.getElementById('toggle-wind').textContent = windEnabled ? 'Disable Wind' : 'Enable Wind';
        
        windStrength = state.settings.windStrength || 0.1;
        document.getElementById('wind-slider').value = windStrength;
        
        defaultBounciness = state.settings.bounciness || 0.7;
        document.getElementById('bounce-slider').value = defaultBounciness;
        
        if (state.settings.theme) {
            setTheme(state.settings.theme);
            document.getElementById('theme-select').value = state.settings.theme;
        }
    }
    

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
   
    if (!themes[theme]) {
        theme = 'boutique';
    }
    
   
    boutiqueColors = themes[theme];
    
   
    document.body.className = '';
    
  
    document.body.classList.add(theme + '-theme');
    
    
    const attractors = document.querySelectorAll('.attractor');
    attractors.forEach(el => {
        
    });
    
    
    const activeButtons = document.querySelectorAll('button.active');
    activeButtons.forEach(button => {
       
    });
    
   
    currentTheme = theme;
    
   
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.value = theme;
    }
    
    
    showFloatingMessage(`Theme changed to ${theme}`);
}


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
       
        Runner.start(runner, engine);
        
        
        const pauseIndicator = document.getElementById('pause-indicator');
        if (pauseIndicator) {
            pauseIndicator.remove();
        }
    }
    
  
    showFloatingMessage(isPaused ? 'Paused (P to resume)' : 'Resumed');
}


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
    
   
    requestAnimationFrame(animate);
    
    
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
    

    let shockwaveStart;
    const shockwaveDuration = 500; 
    
    function animateShockwave(timestamp) {
        if (!shockwaveStart) shockwaveStart = timestamp;
        const elapsed = timestamp - shockwaveStart;
        const progress = Math.min(elapsed / shockwaveDuration, 1);
        
       
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
    
    
    const bodies = Composite.allBodies(engine.world);
    
    
    setTimeout(() => {
        bodies.forEach(body => {
            if (body.isStatic) return;
            
            const dx = body.position.x - pos.x;
            const dy = body.position.y - pos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < radius) {
                
                const normalizedDistance = distance / radius;
                const forceFactor = 1 - (normalizedDistance * normalizedDistance * normalizedDistance);
                
                
                const forceMagnitude = strength * forceFactor * body.mass;
                
               
                const angle = Math.atan2(dy, dx);
                const randomVariation = (Math.random() * 0.1) - 0.05; 
                
               
                Body.applyForce(body, body.position, {
                    x: Math.cos(angle + randomVariation) * forceMagnitude,
                    y: Math.sin(angle + randomVariation) * forceMagnitude * 0.85 
                });
                
               
                const rotationFactor = (1 - normalizedDistance) * 0.02;
                Body.setAngularVelocity(
                    body, 
                    body.angularVelocity + (Math.random() * 2 - 1) * rotationFactor
                );
            }
        });
    }, 10); 
    

    const particleCount = isMobile() ? 15 : 30; 
    
    for (let i = 0; i < particleCount; i++) {
        
        setTimeout(() => {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * radius * 0.6;
            
           
            const particlePosition = {
                x: pos.x + Math.cos(angle) * distance * (i % 3 === 0 ? 0.5 : 1),
                y: pos.y + Math.sin(angle) * distance * (i % 3 === 0 ? 0.5 : 1)
            };
            
           
            const particleSize = 4 + Math.random() * (i % 3 === 0 ? 8 : 4);
            
         
            const effectType = i % 5;
            createCollisionParticle(particlePosition, particleSize, getRandomColorFromTheme());
        }, i * (isMobile() ? 40 : 20)); 
}


function createTextObject(text = "Hello", position = lastMousePos) {
    
    const measureElement = document.createElement('div');
    measureElement.style.position = 'absolute';
    measureElement.style.visibility = 'hidden';
    measureElement.style.fontSize = '20px';
    measureElement.style.fontFamily = 'Arial, sans-serif';
    measureElement.style.fontWeight = 'bold';
    measureElement.style.padding = '5px';
    measureElement.textContent = text;
    document.body.appendChild(measureElement);
    
   
    const width = measureElement.offsetWidth;
    const height = measureElement.offsetHeight;
    
    
    measureElement.remove();
    
   
    const backgroundColor = getRandomColorFromTheme();
    
    
    const textColor = getContrastingColor(backgroundColor);
    
    
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
    
 
    textBody.textContent = text;
    textBody.isTextObject = true;
    textBody.fontSize = 20;
    textBody.fontColor = textColor;
    textBody.originalStrokeStyle = 'rgba(255, 255, 255, 0.3)';
    
    
    Composite.add(engine.world, textBody);
    
    return textBody;
}


function getContrastingColor(hexColor) {
    
    hexColor = hexColor.replace('#', '');
    
    
    let r = parseInt(hexColor.substr(0, 2), 16);
    let g = parseInt(hexColor.substr(2, 2), 16);
    let b = parseInt(hexColor.substr(4, 2), 16);
    
   
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    
    return brightness > 128 ? '#000000' : '#FFFFFF';
}


function addCursorFollower() {
    const follower = document.createElement('div');
    follower.className = 'cursor-follower'; 
    document.body.appendChild(follower);
    return follower;
}


let cursorFollower;
let isTouch = false;


function setupCursorAndTouchEvents() {
    
    cursorFollower = document.createElement('div');
    cursorFollower.className = 'cursor-follower';
    document.body.appendChild(cursorFollower);
    
   
    window.addEventListener('touchstart', function() {
        isTouch = true;
    }, { once: true });

    
    document.addEventListener('mousemove', function(e) {
        if (isTouch) return; 
        
        cursorFollower.style.left = e.clientX + 'px';
        cursorFollower.style.top = e.clientY + 'px';
        
        
        lastMousePos.x = e.clientX;
        lastMousePos.y = e.clientY;
    });
    
   
    document.addEventListener('touchmove', function(e) {
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            cursorFollower.style.left = touch.clientX + 'px';
            cursorFollower.style.top = touch.clientY + 'px';
            
            // Update last mouse position for other functions
            lastMousePos.x = touch.clientX;
            lastMousePos.y = touch.clientY;
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

// Initialize mobile support functions
function initMobileSupport() {
    // Detect if device is mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        // Add mobile-specific CSS class
        document.body.classList.add('mobile');
        
        // Adjust physics parameters for better mobile performance
        engine.timing.timeScale = 0.8;
        
        // Adjust positioning of controls for mobile
        const controls = document.querySelector('.controls');
        if (controls) {
            controls.style.maxHeight = '60vh';
            controls.style.overflow = 'auto';
        }
    }
}


function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}


function createGlowEffect(type, object, options = {}) {
    
    if (isMobile()) return;
    
    const size = options.size || 20;
    const color = options.color || getRandomColorFromTheme();
    
    
    const element = document.createElement('div');
    element.className = `glow-effect ${type}-glow`;
    
    
    switch (type) {
        case 'shape':
            // Track movement of physics body
            object.glowElement = element;
            break;
            
        case 'attractor':
            // Fixed position for attractor
            element.style.position = 'absolute';
            element.style.left = object.position.x + 'px';
            element.style.top = object.position.y + 'px';
            element.style.width = (size * 2) + 'px';
            element.style.height = (size * 2) + 'px';
            element.style.transform = 'translate(-50%, -50%)';
            element.style.borderRadius = '50%';
            element.style.boxShadow = `0 0 ${size}px ${size/2}px ${color}`;
            element.style.opacity = '0.5';
            element.style.pointerEvents = 'none';
            break;
    }
    
    // Add to document
    document.body.appendChild(element);
    
    // Track in glowElements
    if (!glowElements[type]) glowElements[type] = [];
    glowElements[type].push({
        element,
        object,
        color
    });
    
    return element;
}

// Function to update glow effects
function updateGlowEffects(timestamp) {
    // Skip if paused
    if (isPaused) return;
    
    // Skip on mobile for performance
    if (isMobile()) return;
    
    // Update shape glows
    glowElements.shapes.forEach((glow, index) => {
        if (!glow.object.position) {
            // Remove if shape no longer exists
            if (glow.element.parentNode) {
                glow.element.parentNode.removeChild(glow.element);
            }
            glowElements.shapes.splice(index, 1);
            return;
        }
        
        // Update position to follow the body
        glow.element.style.left = glow.object.position.x + 'px';
        glow.element.style.top = glow.object.position.y + 'px';
    });
}

// Define missing allActionButtons array
const allActionButtons = [
    'add-circle', 'add-square', 'add-triangle', 'add-star', 'add-sand', 'add-text',
    'toggle-wind', 'add-attractor', 'toggle-collision-sparks', 'create-explosion',
    'add-portal', 'toggle-pause', 'add-gravity-zone'
];

// Function to clear active state from buttons
function clearActiveState(buttonIds) {
    buttonIds.forEach(id => {
        const button = document.getElementById(id);
        if (button) {
            button.classList.remove('active');
        }
    });
}

// Portal handling functions
function handlePortalPlacement(event) {
    // Implement basic portal placement logic
    const x = event.clientX;
    const y = event.clientY;
    
    showFloatingMessage('Portal feature coming soon!');
}

function renderPortals(context) {
    // Placeholder for portal rendering
}

function checkPortalTeleportation() {
    // Placeholder for portal teleportation logic
}
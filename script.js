// Global variables for physics and interaction that need to be exposed to inline functions
window.world = null;
window.Matter = Matter;
window.currentMode = 'add-circle'; // Default shape mode
window.cursorMode = false;
window.attractorMode = false;
window.portalMode = false;
window.explosionMode = false;
window.gravityZoneMode = false;
window.lastMousePos = { x: 0, y: 0 }; 

let selectedBody = null;
let draggedBody = null;
let resizing = false;
let initialResizeDistance = 0;
let initialScale = 1;
let lastClickTime = 0;
const doubleClickThreshold = 300;
let sizePreviewElement;

// Variables for wind
let windEnabled = false;
let windStrength = 0.3;
let windDirection = 1;
let windVariability = 0.2;
let windForce = 0;
let windInterval = null;

// Variables for special modes
let attractor = null;
let portal = { source: null, destination: null };
let attractorStrength = 0.05;

// Initialize matter.js engine, world, runner and renderer
const engine = Matter.Engine.create({
    gravity: {
        x: 0,
        y: 0.6  // Lower gravity for more realistic falling speed
    },
    positionIterations: 10,   // Increased for better collision detection
    velocityIterations: 8,    // Increased for better collision detection
    constraintIterations: 4,  // Increased for stability
    enableSleeping: true      // Allow objects to sleep when they stop moving
});

// Add collision detection enhancement for high-speed objects
Matter.Resolver._restingThresh = 0.001; // Lower threshold for better collision detection

window.world = engine.world; // Expose world to global scope
const world = engine.world;  // Keep local reference for convenience
const runner = Matter.Runner.create({
    isFixed: true,           // Fixed time step
    delta: 1000/60           // 60 FPS for smooth simulation
});

// Wait for DOM to be ready before creating the renderer
let render;
document.addEventListener('DOMContentLoaded', function() {
    // Create the renderer now that the DOM is ready
    render = Matter.Render.create({
        canvas: document.getElementById('physics-canvas'),
        engine: engine,
        options: {
            width: window.innerWidth,
            height: window.innerHeight,
            wireframes: false,
            background: 'transparent'
        }
    });

    // Start the engine, runner and renderer in order
    Matter.Runner.run(runner, engine);
    Matter.Render.run(render);
    
    // Setup physics environment
    setupPhysics();
    setupCursorMode();
    setupWind();
    setupShapeCreation();
    setupSpecialModes();
    setupGravityZoneMode();
    createStaticBase(); // Create the base
    
    // Debug: Create a test shape to verify physics is working
    setTimeout(function() {
        createCircle({x: window.innerWidth/2, y: 100}, '#EA4335');
        console.log("Test shape created on startup");
    }, 1000);
    
    // Add event listeners for window resize
    window.addEventListener('resize', function() {
        render.options.width = window.innerWidth;
        render.options.height = window.innerHeight;
        render.canvas.width = window.innerWidth;
        render.canvas.height = window.innerHeight;
        
        // Update the base position when window is resized
        updateBasePosition();
    });
});

// Set up wind and gravity
function setupPhysics() {
    // Default gravity
    engine.world.gravity.y = 1;
    
    // Initialize wind indicator
    const windIndicator = document.querySelector('.wind-indicator');
    const windArrow = document.querySelector('.wind-arrow');
    
    // Size preview element
    sizePreviewElement = document.getElementById('size-preview');
    
    // Set up gravity slider
    const gravitySlider = document.getElementById('gravity-slider');
    const gravityValueDisplay = document.querySelector('.gravity-slider .slider-value');
    
    gravitySlider.addEventListener('input', function() {
        const gravityValue = parseFloat(this.value);
        engine.world.gravity.y = gravityValue;
        gravityValueDisplay.textContent = gravityValue.toFixed(1);
    });
    
    // Add event listener for clearing all objects
    document.getElementById('clear-all').addEventListener('click', function() {
        const bodies = Matter.Composite.allBodies(world);
        bodies.forEach(body => {
            if (!body.isStatic || body.label === 'attractor' || body.label === 'portal') {
                Matter.Composite.remove(world, body);
            }
        });
        
        // Reset special modes
        if (attractor) {
            Matter.Composite.remove(world, attractor);
            attractor = null;
        }
        portal = { source: null, destination: null };
    });
}

// Create the resize functionality for cursor mode
function setupCursorMode() {
    const canvas = document.getElementById('physics-canvas');
    const cursorModeButton = document.getElementById('cursor-mode');
    
    cursorModeButton.addEventListener('click', function() {
        // Toggle cursor mode
        cursorMode = !cursorMode;
        this.classList.toggle('active');
        
        if (cursorMode) {
            // Deactivate other modes
            attractorMode = false;
            portalMode = false;
            explosionMode = false;
            gravityZoneMode = false;
            currentMode = 'cursor-mode';
            
            // Update UI to reflect mode change
            document.getElementById('toggle-attractor').classList.remove('active');
            document.getElementById('toggle-portal').classList.remove('active');
            document.getElementById('create-explosion').classList.remove('active');
            document.querySelectorAll('.shape-button').forEach(btn => btn.classList.remove('active'));
            
            // Add cursor mode class to body
            document.body.classList.add('cursor-mode-active');
        } else {
            // Remove cursor mode class
            document.body.classList.remove('cursor-mode-active');
            currentMode = 'add-circle'; // Default back to add-circle mode
        }
    });

    // Handle mouse down for object selection
    canvas.addEventListener('mousedown', function(event) {
        if (!cursorMode) return;
        
        const mousePosition = {
            x: event.clientX,
            y: event.clientY
        };
        
        // Check for double click to delete an object
        const currentTime = new Date().getTime();
        const isDoubleClick = (currentTime - lastClickTime < doubleClickThreshold);
        lastClickTime = currentTime;
        
        // Get body under cursor
        const bodyUnderCursor = getBodyAtPosition(mousePosition);
        
        if (bodyUnderCursor) {
            if (isDoubleClick) {
                // Remove the body on double click
                Matter.Composite.remove(world, bodyUnderCursor);
                selectedBody = null;
                return;
            }
            
            // Select body for dragging or resizing
            selectedBody = bodyUnderCursor;
            
            // Check if mouse is near the edge for resizing
            const distanceFromCenter = Math.sqrt(
                Math.pow(mousePosition.x - selectedBody.position.x, 2) +
                Math.pow(mousePosition.y - selectedBody.position.y, 2)
            );
            
            const bodyRadius = selectedBody.circleRadius || 
                               Math.max(selectedBody.bounds.max.x - selectedBody.bounds.min.x, 
                                       selectedBody.bounds.max.y - selectedBody.bounds.min.y) / 2;
            
            if (distanceFromCenter > bodyRadius * 0.7) {
                // Near edge - start resizing
                resizing = true;
                initialResizeDistance = distanceFromCenter;
                initialScale = selectedBody.render.sprite ? selectedBody.render.sprite.xScale : 1;
                
                // Show size preview
                sizePreviewElement.style.display = 'block';
                sizePreviewElement.style.width = bodyRadius * 2 + 'px';
                sizePreviewElement.style.height = bodyRadius * 2 + 'px';
                sizePreviewElement.style.left = selectedBody.position.x - bodyRadius + 'px';
                sizePreviewElement.style.top = selectedBody.position.y - bodyRadius + 'px';
            } else {
                // Center area - enable dragging
                draggedBody = selectedBody;
                Matter.Body.setStatic(draggedBody, true);
            }
        }
    });

    // Handle mouse move for dragging and resizing
    canvas.addEventListener('mousemove', function(event) {
        if (!cursorMode) return;
        
        const mousePosition = {
            x: event.clientX,
            y: event.clientY
        };
        
        // Save mouse position for other operations
        lastMousePos = mousePosition;
        
        if (draggedBody) {
            // Move the selected body
            Matter.Body.setPosition(draggedBody, mousePosition);
        } else if (resizing && selectedBody) {
            // Calculate distance from center for resizing
            const distanceFromCenter = Math.sqrt(
                Math.pow(mousePosition.x - selectedBody.position.x, 2) +
                Math.pow(mousePosition.y - selectedBody.position.y, 2)
            );
            
            // Calculate scale factor based on distance change
            const scaleFactor = distanceFromCenter / initialResizeDistance;
            
            // Update size preview element
            const currentRadius = selectedBody.circleRadius || 
                                 Math.max(selectedBody.bounds.max.x - selectedBody.bounds.min.x, 
                                         selectedBody.bounds.max.y - selectedBody.bounds.min.y) / 2;
            const newSize = currentRadius * 2 * scaleFactor;
            
            sizePreviewElement.style.width = newSize + 'px';
            sizePreviewElement.style.height = newSize + 'px';
            sizePreviewElement.style.left = selectedBody.position.x - newSize/2 + 'px';
            sizePreviewElement.style.top = selectedBody.position.y - newSize/2 + 'px';
        }
    });

    // Handle mouse up to stop dragging or apply resize
    canvas.addEventListener('mouseup', function() {
        if (draggedBody) {
            Matter.Body.setStatic(draggedBody, false);
            draggedBody = null;
        }
        
        if (resizing && selectedBody) {
            // Calculate new scale based on preview size
            const previewSize = parseFloat(sizePreviewElement.style.width);
            const currentSize = selectedBody.circleRadius ? 
                               selectedBody.circleRadius * 2 : 
                               Math.max(selectedBody.bounds.max.x - selectedBody.bounds.min.x, 
                                       selectedBody.bounds.max.y - selectedBody.bounds.min.y);
            
            const scaleFactor = previewSize / currentSize;
            
            // Apply the new scale to the selected body
            Matter.Body.scale(selectedBody, scaleFactor, scaleFactor);
            
            // Hide size preview
            sizePreviewElement.style.display = 'none';
            resizing = false;
        }
        
        selectedBody = null;
    });
}

// Get the body at a specific position
function getBodyAtPosition(position) {
    // Query all bodies in the world
    const bodies = Matter.Composite.allBodies(world);
    
    // Find the body under the cursor
    for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        
        if (Matter.Bounds.contains(body.bounds, position)) {
            const vertices = body.vertices;
            
            // Check if position is inside polygon
            if (body.circleRadius) {
                // For circles, check if distance to center is less than radius
                const distance = Math.sqrt(
                    Math.pow(position.x - body.position.x, 2) +
                    Math.pow(position.y - body.position.y, 2)
                );
                
                if (distance <= body.circleRadius) {
                    return body;
                }
            } else {
                // For polygons, check if point is inside
                if (Matter.Vertices.contains(vertices, position)) {
                    return body;
                }
            }
        }
    }
    
    return null;
}

// Set up wind physics
function setupWind() {
    const toggleWindButton = document.getElementById('toggle-wind');
    const windSlider = document.getElementById('wind-slider');
    
    // Check if wind UI elements exist before trying to use them
    const windValueDisplay = document.querySelector('#wind-slider + .slider-header .slider-value');
    const windIndicator = document.querySelector('.wind-indicator');
    const windArrow = document.querySelector('.wind-arrow');
    
    // Safety check - don't proceed if required UI elements are missing
    if (!toggleWindButton || !windSlider) {
        console.warn('Wind control elements missing from the DOM');
        return;
    }
    
    // Update wind strength display if the element exists
    if (windSlider && windValueDisplay) {
        windSlider.addEventListener('input', function() {
            windStrength = parseFloat(this.value);
            windValueDisplay.textContent = windStrength.toFixed(2);
        });
        
        // Initialize wind value display
        windValueDisplay.textContent = windSlider.value;
    }
    
    toggleWindButton.addEventListener('click', function() {
        windEnabled = !windEnabled;
        this.classList.toggle('active');
        
        if (windEnabled) {
            // Show wind indicator if it exists
            if (windIndicator) {
                windIndicator.classList.add('visible');
            }
            
            // Start wind interval
            clearInterval(windInterval);
            windInterval = setInterval(function() {
                // Randomly vary wind strength
                const variation = (Math.random() * 2 - 1) * windVariability;
                windStrength = parseFloat(windSlider.value) + variation;
                
                // Randomly change direction occasionally
                if (Math.random() < 0.03) {
                    windDirection *= -1;
                }
                
                // Calculate wind force
                windForce = windStrength * windDirection;
                
                // Update wind indicator if it exists
                if (windArrow) {
                    windArrow.style.transform = windDirection > 0 ? 'scaleX(1)' : 'scaleX(-1)';
                    windArrow.style.width = (40 + Math.abs(windForce) * 60) + '%';
                }
                
                // Apply wind force to all bodies
                const bodies = Matter.Composite.allBodies(world);
                for (let i = 0; i < bodies.length; i++) {
                    const body = bodies[i];
                    if (!body.isStatic) {
                        const area = body.circleRadius ? 
                                    Math.PI * body.circleRadius * body.circleRadius : 
                                    (body.bounds.max.x - body.bounds.min.x) * (body.bounds.max.y - body.bounds.min.y);
                        
                        const forceMagnitude = area * 0.001 * windForce;
                        Matter.Body.applyForce(body, body.position, { x: forceMagnitude, y: 0 });
                    }
                }
            }, 100);
        } else {
            // Hide wind indicator if it exists
            if (windIndicator) {
                windIndicator.classList.remove('visible');
            }
            
            // Clear wind interval
            clearInterval(windInterval);
            windInterval = null;
        }
    });
}

// Setup shape creation functions
function setupShapeCreation() {
    const canvas = document.getElementById('physics-canvas');
    const colorPicker = document.getElementById('shape-color');
    
    // Direct function to create shapes when buttons are clicked
    function createShapeAtCenter(shapeType) {
        // Get center of visible area
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 3; // Higher up so it can fall
        const position = { x: centerX, y: centerY };
        const color = colorPicker.value;
        
        // Create the selected shape
        switch(shapeType) {
            case 'circle':
                createCircle(position, color);
                break;
            case 'rectangle':
                createRectangle(position, color);
                break;
            case 'polygon':
                createPolygon(position, color);
                break;
            case 'square':
                createSquare(position, color);
                break;
            case 'star':
                createStar(position, color);
                break;
        }
    }
    
    // Add event listeners for shape buttons with direct creation
    document.getElementById('add-circle').addEventListener('click', function(event) {
        // Stop event propagation
        event.stopPropagation();
        
        // Set the current mode
        cursorMode = false;
        attractorMode = false;
        portalMode = false;
        explosionMode = false;
        currentMode = 'add-circle';
        
        // Update UI
        document.getElementById('cursor-mode').classList.remove('active');
        document.getElementById('toggle-attractor').classList.remove('active');
        document.getElementById('toggle-portal').classList.remove('active');
        document.getElementById('create-explosion').classList.remove('active');
        
        // Highlight active shape button
        document.querySelectorAll('.shape-button').forEach(btn => {
            btn.classList.remove('active');
        });
        this.classList.add('active');
        
        // Create a circle immediately
        createShapeAtCenter('circle');
        
        console.log('Circle created');
    });
    
    document.getElementById('add-rectangle').addEventListener('click', function(event) {
        // Stop event propagation
        event.stopPropagation();
        
        // Set the current mode
        cursorMode = false;
        attractorMode = false;
        portalMode = false;
        explosionMode = false;
        currentMode = 'add-rectangle';
        
        // Update UI
        document.getElementById('cursor-mode').classList.remove('active');
        document.getElementById('toggle-attractor').classList.remove('active');
        document.getElementById('toggle-portal').classList.remove('active');
        document.getElementById('create-explosion').classList.remove('active');
        
        // Highlight active shape button
        document.querySelectorAll('.shape-button').forEach(btn => {
            btn.classList.remove('active');
        });
        this.classList.add('active');
        
        // Create a rectangle immediately
        createShapeAtCenter('rectangle');
        
        console.log('Rectangle created');
    });
    
    document.getElementById('add-polygon').addEventListener('click', function(event) {
        // Stop event propagation
        event.stopPropagation();
        
        // Set the current mode
        cursorMode = false;
        attractorMode = false;
        portalMode = false;
        explosionMode = false;
        currentMode = 'add-polygon';
        
        // Update UI
        document.getElementById('cursor-mode').classList.remove('active');
        document.getElementById('toggle-attractor').classList.remove('active');
        document.getElementById('toggle-portal').classList.remove('active');
        document.getElementById('create-explosion').classList.remove('active');
        
        // Highlight active shape button
        document.querySelectorAll('.shape-button').forEach(btn => {
            btn.classList.remove('active');
        });
        this.classList.add('active');
        
        // Create a polygon immediately
        createShapeAtCenter('polygon');
        
        console.log('Polygon created');
    });
    
    document.getElementById('add-square').addEventListener('click', function(event) {
        // Stop event propagation
        event.stopPropagation();
        
        // Set the current mode
        cursorMode = false;
        attractorMode = false;
        portalMode = false;
        explosionMode = false;
        currentMode = 'add-square';
        
        // Update UI
        document.getElementById('cursor-mode').classList.remove('active');
        document.getElementById('toggle-attractor').classList.remove('active');
        document.getElementById('toggle-portal').classList.remove('active');
        document.getElementById('create-explosion').classList.remove('active');
        
        // Highlight active shape button
        document.querySelectorAll('.shape-button').forEach(btn => {
            btn.classList.remove('active');
        });
        this.classList.add('active');
        
        // Create a square immediately
        createShapeAtCenter('square');
        
        console.log('Square created');
    });
    
    document.getElementById('add-star').addEventListener('click', function(event) {
        // Stop event propagation
        event.stopPropagation();
        
        // Set the current mode
        cursorMode = false;
        attractorMode = false;
        portalMode = false;
        explosionMode = false;
        currentMode = 'add-star';
        
        // Update UI
        document.getElementById('cursor-mode').classList.remove('active');
        document.getElementById('toggle-attractor').classList.remove('active');
        document.getElementById('toggle-portal').classList.remove('active');
        document.getElementById('create-explosion').classList.remove('active');
        
        // Highlight active shape button
        document.querySelectorAll('.shape-button').forEach(btn => {
            btn.classList.remove('active');
        });
        this.classList.add('active');
        
        // Create a star immediately
        createShapeAtCenter('star');
        
        console.log('Star created');
    });
    
    // Canvas click handler for creating additional shapes
    canvas.addEventListener('click', function(event) {
        // Check if we clicked on the control panel
        const controlsPanel = document.querySelector('.controls-panel');
        const rect = controlsPanel.getBoundingClientRect();
        
        // Don't create shapes if we clicked on controls or are in other modes
        if (event.clientX >= rect.left && event.clientX <= rect.right &&
            event.clientY >= rect.top && event.clientY <= rect.bottom ||
            cursorMode || attractorMode || portalMode || explosionMode) {
            return;
        }
        
        const mousePosition = {
            x: event.clientX,
            y: event.clientY
        };
        
        // Create different shapes based on current mode
        const color = colorPicker.value;
        
        switch (currentMode) {
            case 'add-circle':
                createCircle(mousePosition, color);
                break;
            case 'add-rectangle':
                createRectangle(mousePosition, color);
                break;
            case 'add-polygon':
                createPolygon(mousePosition, color);
                break;
            case 'add-square':
                createSquare(mousePosition, color);
                break;
            case 'add-star':
                createStar(mousePosition, color);
                break;
        }
    });
}

// Create a circle at the specified position
function createCircle(position, color) {
    const radius = 30 + Math.random() * 20;
    const circle = Matter.Bodies.circle(position.x, position.y, radius, {
        restitution: 0.3 + Math.random() * 0.2, // Moderate bounce, varied slightly
        friction: 0.2 + Math.random() * 0.4,    // Moderate to high friction
        frictionAir: 0.002,                     // Slightly higher air resistance
        density: 0.002 + Math.random() * 0.001, // Realistic density
        render: {
            fillStyle: color,
            strokeStyle: '#000000',
            lineWidth: 1
        }
    });
    
    Matter.Composite.add(world, circle);
}

// Create a rectangle at the specified position
function createRectangle(position, color) {
    const width = 40 + Math.random() * 40;
    const height = 40 + Math.random() * 40;
    const rectangle = Matter.Bodies.rectangle(position.x, position.y, width, height, {
        restitution: 0.2 + Math.random() * 0.15, // Lower bounce for rectangles
        friction: 0.3 + Math.random() * 0.3,     // Higher friction
        frictionAir: 0.001 + Math.random() * 0.002, // Varied air resistance
        density: 0.0015 + Math.random() * 0.001,    // Realistic density
        render: {
            fillStyle: color,
            strokeStyle: '#000000',
            lineWidth: 1
        }
    });
    
    Matter.Composite.add(world, rectangle);
}

// Create a polygon at the specified position
function createPolygon(position, color) {
    const sides = Math.floor(3 + Math.random() * 5); // 3 to 7 sides
    const radius = 30 + Math.random() * 20;
    const polygon = Matter.Bodies.polygon(position.x, position.y, sides, radius, {
        restitution: 0.2 + Math.random() * 0.1, // Low bounce for polygons
        friction: 0.4 + Math.random() * 0.3,    // High friction
        frictionAir: 0.001 + Math.random() * 0.001, // Some air resistance
        density: 0.002 + Math.random() * 0.002,     // Varied density
        render: {
            fillStyle: color,
            strokeStyle: '#000000',
            lineWidth: 1
        }
    });
    
    Matter.Composite.add(world, polygon);
}

// Create a square at the specified position
function createSquare(position, color) {
    const size = 40 + Math.random() * 20; // Size between 40-60px
    const square = Matter.Bodies.rectangle(position.x, position.y, size, size, {
        restitution: 0.1 + Math.random() * 0.2, // Low to moderate bounce
        friction: 0.3 + Math.random() * 0.4,    // Moderate to high friction
        frictionAir: 0.001,                     // Normal air resistance
        density: 0.002 + Math.random() * 0.001, // Slightly heavier
        render: {
            fillStyle: color,
            strokeStyle: '#000000',
            lineWidth: 1
        }
    });
    
    Matter.Composite.add(world, square);
}

// Create a star shape at the specified position
function createStar(position, color) {
    const outerRadius = 30 + Math.random() * 15;
    const innerRadius = outerRadius * 0.4;
    const numPoints = 5;
    
    // Create vertices for a star shape
    const vertices = [];
    for (let i = 0; i < numPoints * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (Math.PI * i) / numPoints;
        vertices.push({
            x: position.x + radius * Math.sin(angle),
            y: position.y + radius * Math.cos(angle)
        });
    }
    
    const star = Matter.Bodies.fromVertices(position.x, position.y, [vertices], {
        restitution: 0.2,         // Low bounce
        friction: 0.4,            // High friction due to points
        frictionAir: 0.002,       // Higher air resistance due to shape
        density: 0.001,           // Light
        render: {
            fillStyle: color,
            strokeStyle: '#000000',
            lineWidth: 1
        }
    });
    
    Matter.Composite.add(world, star);
}

// Setup special physics modes (attractor, portal, explosion)
function setupSpecialModes() {
    const canvas = document.getElementById('physics-canvas');
    
    // Attractor mode
    document.getElementById('toggle-attractor').addEventListener('click', function() {
        attractorMode = !attractorMode;
        this.classList.toggle('active');
        
        if (attractorMode) {
            // Deactivate other modes
            cursorMode = false;
            portalMode = false;
            explosionMode = false;
            currentMode = 'attractor-mode';
            
            // Update UI to reflect mode change
            document.getElementById('cursor-mode').classList.remove('active');
            document.getElementById('toggle-portal').classList.remove('active');
            document.getElementById('create-explosion').classList.remove('active');
            document.querySelectorAll('.shape-button').forEach(btn => btn.classList.remove('active'));
            
            // If there's an existing attractor, remove it
            if (attractor) {
                Matter.Composite.remove(world, attractor);
                attractor = null;
            }
        }
    });
    
    // Portal mode
    document.getElementById('toggle-portal').addEventListener('click', function() {
        portalMode = !portalMode;
        this.classList.toggle('active');
        
        if (portalMode) {
            // Deactivate other modes
            cursorMode = false;
            attractorMode = false;
            explosionMode = false;
            currentMode = 'portal-mode';
            
            // Update UI to reflect mode change
            document.getElementById('cursor-mode').classList.remove('active');
            document.getElementById('toggle-attractor').classList.remove('active');
            document.getElementById('create-explosion').classList.remove('active');
            document.querySelectorAll('.shape-button').forEach(btn => btn.classList.remove('active'));
            
            // Reset portal points
            portal = { source: null, destination: null };
        }
    });
    
    // Explosion mode
    document.getElementById('create-explosion').addEventListener('click', function() {
        explosionMode = !explosionMode;
        this.classList.toggle('active');
        
        if (explosionMode) {
            // Deactivate other modes
            cursorMode = false;
            attractorMode = false;
            portalMode = false;
            currentMode = 'explosion-mode';
            
            // Update UI to reflect mode change
            document.getElementById('cursor-mode').classList.remove('active');
            document.getElementById('toggle-attractor').classList.remove('active');
            document.getElementById('toggle-portal').classList.remove('active');
            document.querySelectorAll('.shape-button').forEach(btn => btn.classList.remove('active'));
        }
    });
    
    // Handle mouse click for special modes
    canvas.addEventListener('click', function(event) {
        const mousePosition = {
            x: event.clientX,
            y: event.clientY
        };
        
        if (attractorMode) {
            createAttractor(mousePosition);
        } else if (portalMode) {
            createPortal(mousePosition);
        } else if (explosionMode) {
            createExplosion(mousePosition);
        }
    });
    
    // Apply attractor force in update loop
    Matter.Events.on(engine, 'beforeUpdate', function() {
        if (attractor) {
            const bodies = Matter.Composite.allBodies(world);
            
            bodies.forEach(body => {
                if (body !== attractor && !body.isStatic) {
                    // Calculate direction vector
                    const direction = {
                        x: attractor.position.x - body.position.x,
                        y: attractor.position.y - body.position.y
                    };
                    
                    // Calculate distance
                    const distance = Math.sqrt(
                        direction.x * direction.x + direction.y * direction.y
                    );
                    
                    // Normalize direction vector
                    if (distance > 0) {
                        direction.x /= distance;
                        direction.y /= distance;
                    }
                    
                    // Apply force with falloff based on distance
                    const forceMagnitude = Math.min(attractorStrength * body.mass / (distance * 0.1), 0.5);
                    Matter.Body.applyForce(body, body.position, {
                        x: direction.x * forceMagnitude,
                        y: direction.y * forceMagnitude
                    });
                }
            });
        }
    });
    
    // Handle portal teleportation
    Matter.Events.on(engine, 'afterUpdate', function() {
        if (portal.source && portal.destination) {
            const bodies = Matter.Composite.allBodies(world);
            
            bodies.forEach(body => {
                if (!body.isStatic && body !== portal.source && body !== portal.destination) {
                    // Check if body is near source portal
                    const distanceToSource = Math.sqrt(
                        Math.pow(body.position.x - portal.source.position.x, 2) +
                        Math.pow(body.position.y - portal.source.position.y, 2)
                    );
                    
                    // If body is close to source portal, teleport to destination
                    if (distanceToSource < portal.source.circleRadius * 1.2) {
                        // Apply slight velocity change to prevent immediate teleportation back
                        const velocityFactor = 1.05;
                        
                        // Set new position and adjust velocity slightly
                        Matter.Body.setPosition(body, {
                            x: portal.destination.position.x,
                            y: portal.destination.position.y
                        });
                        
                        Matter.Body.setVelocity(body, {
                            x: body.velocity.x * velocityFactor,
                            y: body.velocity.y * velocityFactor
                        });
                    }
                }
            });
        }
    });
}

// Create attractor at the specified position
function createAttractor(position) {
    // Remove existing attractor if there is one
    if (attractor) {
        Matter.Composite.remove(world, attractor);
    }
    
    // Create the attractor body
    attractor = Matter.Bodies.circle(position.x, position.y, 25, {
        isStatic: true,
        collisionFilter: { group: -1 }, // No collision with other bodies
        render: {
            fillStyle: '#FF5722',
            lineWidth: 0,
            sprite: {
                texture: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50"><radialGradient id="grad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%"><stop offset="0%" stop-color="rgba(255,87,34,1)" /><stop offset="100%" stop-color="rgba(255,87,34,0)" /></radialGradient><circle cx="25" cy="25" r="25" fill="url(%23grad)" /></svg>',
                xScale: 2,
                yScale: 2
            }
        },
        label: 'attractor'
    });
    
    Matter.Composite.add(world, attractor);
}

// Create portal at the specified position
function createPortal(position) {
    if (!portal.source) {
        // Create source portal
        portal.source = Matter.Bodies.circle(position.x, position.y, 30, {
            isStatic: true,
            collisionFilter: { group: -1 }, // No collision with other bodies
            render: {
                fillStyle: '#3F51B5',
                sprite: {
                    texture: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><radialGradient id="grad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%"><stop offset="0%" stop-color="rgba(63,81,181,1)" /><stop offset="100%" stop-color="rgba(63,81,181,0.3)" /></radialGradient><circle cx="30" cy="30" r="30" fill="url(%23grad)" /></svg>',
                    xScale: 2,
                    yScale: 2
                }
            },
            label: 'portal'
        });
        
        Matter.Composite.add(world, portal.source);
    } else if (!portal.destination) {
        // Create destination portal
        portal.destination = Matter.Bodies.circle(position.x, position.y, 30, {
            isStatic: true,
            collisionFilter: { group: -1 }, // No collision with other bodies
            render: {
                fillStyle: '#9C27B0',
                sprite: {
                    texture: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><radialGradient id="grad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%"><stop offset="0%" stop-color="rgba(156,39,176,1)" /><stop offset="100%" stop-color="rgba(156,39,176,0.3)" /></radialGradient><circle cx="30" cy="30" r="30" fill="url(%23grad)" /></svg>',
                    xScale: 2,
                    yScale: 2
                }
            },
            label: 'portal'
        });
        
        Matter.Composite.add(world, portal.destination);
    }
}

// Create explosion at the specified position
function createExplosion(position) {
    const radius = 150; // Explosion radius
    const bodies = Matter.Composite.allBodies(world);
    
    // Create visual effect
    const explosionEffect = document.createElement('div');
    explosionEffect.className = 'explosion-effect';
    explosionEffect.style.left = (position.x - radius) + 'px';
    explosionEffect.style.top = (position.y - radius) + 'px';
    explosionEffect.style.width = (radius * 2) + 'px';
    explosionEffect.style.height = (radius * 2) + 'px';
    document.body.appendChild(explosionEffect);
    
    // Fade out and remove the effect
    setTimeout(() => {
        explosionEffect.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(explosionEffect);
        }, 500);
    }, 100);
    
    // Apply force to all bodies within radius
    bodies.forEach(body => {
        if (!body.isStatic) {
            const distance = Math.sqrt(
                Math.pow(body.position.x - position.x, 2) +
                Math.pow(body.position.y - position.y, 2)
            );
            
            if (distance < radius) {
                // Calculate direction vector
                const direction = {
                    x: body.position.x - position.x,
                    y: body.position.y - position.y
                };
                
                // Normalize direction vector
                const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
                if (magnitude > 0) {
                    direction.x /= magnitude;
                    direction.y /= magnitude;
                }
                
                // Force decreases with distance
                const forceMagnitude = 0.15 * body.mass * (1 - distance / radius);
                
                // Apply explosion force
                Matter.Body.applyForce(body, body.position, {
                    x: direction.x * forceMagnitude,
                    y: direction.y * forceMagnitude
                });
            }
        }
    });
}

// Setup gravity zone mode
function setupGravityZoneMode() {
    const canvas = document.getElementById('physics-canvas');
    const toggleGravityZone = document.getElementById('toggle-gravity-zone');
    
    toggleGravityZone.addEventListener('click', function() {
        gravityZoneMode = !gravityZoneMode;
        this.classList.toggle('active');
        
        if (gravityZoneMode) {
            // Deactivate other modes
            cursorMode = false;
            attractorMode = false;
            portalMode = false;
            explosionMode = false;
            currentMode = 'gravity-zone-mode';
            
            // Update UI to reflect mode change
            document.getElementById('cursor-mode').classList.remove('active');
            document.getElementById('toggle-attractor').classList.remove('active');
            document.getElementById('toggle-portal').classList.remove('active');
            document.getElementById('create-explosion').classList.remove('active');
            document.querySelectorAll('.shape-button').forEach(btn => btn.classList.remove('active'));
        }
    });
    
    canvas.addEventListener('click', function(event) {
        if (!gravityZoneMode) return;
        
        const mousePosition = {
            x: event.clientX,
            y: event.clientY
        };
        
        createGravityZone(mousePosition);
    });
}

// Create a gravity zone at the specified position
function createGravityZone(position) {
    const radius = 100;
    const gravityZone = Matter.Bodies.circle(position.x, position.y, radius, {
        isStatic: true,
        collisionFilter: { group: -1 }, // No collision with other bodies
        render: {
            fillStyle: 'rgba(76, 175, 80, 0.2)',
            strokeStyle: '#4CAF50',
            lineWidth: 2
        },
        label: 'gravity-zone'
    });
    
    // Customize gravity direction within this zone
    gravityZone.gravityDirection = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 };
    
    Matter.Composite.add(world, gravityZone);
    
    // Add gravity zone effect to beforeUpdate event
    Matter.Events.on(engine, 'beforeUpdate', function() {
        const bodies = Matter.Composite.allBodies(world);
        const gravityZones = bodies.filter(body => body.label === 'gravity-zone');
        
        for (const zone of gravityZones) {
            bodies.forEach(body => {
                if (!body.isStatic && body.label !== 'gravity-zone') {
                    // Check if body is inside gravity zone
                    const distance = Math.sqrt(
                        Math.pow(body.position.x - zone.position.x, 2) +
                        Math.pow(body.position.y - zone.position.y, 2)
                    );
                    
                    if (distance < zone.circleRadius) {
                        // Apply custom gravity force
                        const forceMagnitude = 0.001 * body.mass;
                        Matter.Body.applyForce(body, body.position, {
                            x: zone.gravityDirection.x * forceMagnitude,
                            y: zone.gravityDirection.y * forceMagnitude
                        });
                    }
                }
            });
        }
    });
}

// Toggle menu position
const togglePositionButton = document.getElementById('toggle-position');
togglePositionButton.addEventListener('click', function() {
    const controlsPanel = document.querySelector('.controls-panel');
    controlsPanel.classList.toggle('left-position');
});

// Initialize theme switching
document.addEventListener('DOMContentLoaded', function() {
    // Setup themes
    setupThemes();
    setupAccentColors();
    setupColorPresets();
});

// Set up theme switching functionality
function setupThemes() {
    // Set up theme dropdown
    const themeDropdown = document.getElementById('theme-dropdown');
    const themeToggle = themeDropdown.querySelector('.dropdown-toggle');
    const themeMenu = themeDropdown.querySelector('.dropdown-menu');
    const themeItems = themeDropdown.querySelectorAll('.dropdown-item');
    const themeNameSpan = themeToggle.querySelector('span');
    
    // Toggle dropdown when clicked
    themeToggle.addEventListener('click', function(event) {
        event.stopPropagation();
        themeDropdown.classList.toggle('open');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(event) {
        if (!themeDropdown.contains(event.target)) {
            themeDropdown.classList.remove('open');
        }
    });
    
    // Handle theme selection
    themeItems.forEach(item => {
        item.addEventListener('click', function() {
            // Get theme data
            const themeName = this.textContent;
            const themeClass = this.getAttribute('data-theme');
            
            // Update dropdown toggle text
            themeNameSpan.textContent = `Theme: ${themeName}`;
            
            // Remove all theme classes
            document.body.classList.remove(
                'theme-modern-dark',
                'theme-modern-blue',
                'theme-modern-purple',
                'theme-modern-mint',
                'theme-modern-sunset'
            );
            
            // Add the selected theme class
            document.body.classList.add(themeClass);
            
            // Update active state on items
            themeItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            // Close the dropdown
            themeDropdown.classList.remove('open');
        });
    });
}

// Set up accent color functionality
function setupAccentColors() {
    const buttonColorPicker = document.getElementById('button-color');
    
    // Add event listener for color change
    buttonColorPicker.addEventListener('input', function() {
        updateAccentColor(this.value);
    });
    
    // Initialize with default color
    updateAccentColor(buttonColorPicker.value);
}

// Update accent color throughout the UI
function updateAccentColor(color) {
    // Convert hex to rgb for CSS variables
    const rgb = hexToRgb(color);
    
    // Set CSS variables
    document.documentElement.style.setProperty('--accent-color', color);
    document.documentElement.style.setProperty('--accent-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    
    // Apply to active elements
    document.querySelectorAll('.active').forEach(el => {
        el.style.color = color;
    });
}

// Set up color preset functionality for both pickers
function setupColorPresets() {
    // For accent color presets
    const accentPresets = document.querySelectorAll('.button-color-picker .color-preset');
    accentPresets.forEach(preset => {
        preset.addEventListener('click', function() {
            const color = this.getAttribute('data-color');
            document.getElementById('button-color').value = color;
            updateAccentColor(color);
        });
    });
    
    // For shape color presets
    const shapePresets = document.querySelectorAll('.color-picker .color-preset');
    shapePresets.forEach(preset => {
        preset.addEventListener('click', function() {
            const color = this.getAttribute('data-color');
            document.getElementById('shape-color').value = color;
        });
    });
}

// Helper function to convert hex to rgb
function hexToRgb(hex) {
    // Remove # if present
    hex = hex.replace(/^#/, '');
    
    // Parse hex values
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    
    return { r, g, b };
}

// Create a static base and walls to contain the shapes
function createStaticBase() {
    // Add console logging to debug base creation
    console.log("Window dimensions:", window.innerWidth, "x", window.innerHeight);
    
    // Create a MASSIVE, can't-miss base in the MIDDLE of the screen
    const base = Matter.Bodies.rectangle(
        window.innerWidth / 2,          // Center horizontally
        window.innerHeight / 2 + 200,   // Lower middle of the screen
        window.innerWidth,              // Full width of screen
        50,                             // Extra thick
        { 
            isStatic: true,
            render: {
                fillStyle: '#FF00FF',   // Bright magenta (very visible)
                strokeStyle: '#FFFF00', // Yellow outline for contrast
                lineWidth: 5            // Extra thick outline
            },
            label: 'base',
            friction: 0.5,
            restitution: 0.3,
            density: 10
        }
    );
    
    // Create a second backup base higher up
    const upperBase = Matter.Bodies.rectangle(
        window.innerWidth / 2,          // Center horizontally
        window.innerHeight / 3,         // Upper third of screen
        window.innerWidth / 1.5,        // 75% width
        40,                             // Thick
        { 
            isStatic: true,
            render: {
                fillStyle: '#00FF00',   // Bright green
                strokeStyle: '#FF0000', // Red outline
                lineWidth: 4            // Thick outline
            },
            label: 'upper-base',
            friction: 0.4,
            restitution: 0.4,
            density: 10
        }
    );
    
    // Add side walls
    const leftWall = Matter.Bodies.rectangle(
        20,                          // Well inside screen
        window.innerHeight / 2,
        40,                          // Very thick wall
        window.innerHeight,
        {
            isStatic: true,
            render: {
                fillStyle: '#00FFFF', // Cyan
                strokeStyle: '#000000',
                lineWidth: 2
            },
            label: 'wall',
            friction: 0.3,
            restitution: 0.3
        }
    );
    
    const rightWall = Matter.Bodies.rectangle(
        window.innerWidth - 20,      // Well inside screen
        window.innerHeight / 2,
        40,                          // Very thick wall
        window.innerHeight,
        {
            isStatic: true,
            render: {
                fillStyle: '#00FFFF', // Cyan
                strokeStyle: '#000000',
                lineWidth: 2
            },
            label: 'wall',
            friction: 0.3,
            restitution: 0.3
        }
    );
    
    // Add all bodies to the world
    Matter.Composite.add(world, [base, upperBase, leftWall, rightWall]);
    
    // Output debug info to console
    console.log("CREATED BASES at these positions:");
    console.log("Main base:", window.innerHeight / 2 + 200);
    console.log("Upper base:", window.innerHeight / 3);
    
    // Create a visible DOM element as a fallback indicator
    const indicator = document.createElement('div');
    indicator.style.position = 'absolute';
    indicator.style.left = '50%';
    indicator.style.top = (window.innerHeight / 2 + 200) + 'px';
    indicator.style.transform = 'translate(-50%, -50%)';
    indicator.style.width = '400px';
    indicator.style.height = '30px';
    indicator.style.backgroundColor = 'red';
    indicator.style.border = '3px solid yellow';
    indicator.style.zIndex = '1000';
    indicator.style.textAlign = 'center';
    indicator.style.color = 'white';
    indicator.style.fontWeight = 'bold';
    indicator.style.padding = '5px';
    indicator.innerHTML = 'THIS IS THE BASE LOCATION';
    document.body.appendChild(indicator);
}
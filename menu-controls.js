document.addEventListener('DOMContentLoaded', function() {
 
    initNavbarActiveState();
    
  
    initScrollReveal();
    
    
    document.addEventListener('scroll', function() {
        updateNavbar();
        updateNavbarActiveState();
    });
});


function updateNavbar() {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
}

// updat active state in navbar based on scroll position
function initNavbarActiveState() {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-links a');
    
    
    updateNavbarActiveState();
    
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                
                targetSection.scrollIntoView({ behavior: 'smooth' });
                
                
                navLinks.forEach(navLink => navLink.classList.remove('active'));
                link.classList.add('active');
            }
        });
    });
}

function updateNavbarActiveState() {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-links a');

    let scrollPosition = window.scrollY + 100; // Offset for better accuracy
    

    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        
        if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
            // Remove active class from all links
            navLinks.forEach(link => link.classList.remove('active'));
            
            // Add active class to current section link
            const targetLink = document.querySelector(`.nav-links a[href="#${section.id}"]`);
            if (targetLink) {
                targetLink.classList.add('active');
            }
        }
    });
}

// Initialize reveal animations on scroll
function initScrollReveal() {
    // Animate about section paragraphs
    const aboutParagraphs = document.querySelectorAll('.about-content p');
    
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.2
    };
    
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // Observe each paragraph
    aboutParagraphs.forEach((paragraph, index) => {
        paragraph.style.transitionDelay = `${0.2 * index}s`;
        observer.observe(paragraph);
    });
    

    const revealElements = document.querySelectorAll('.reveal');
    
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // Observe each reveal element
    revealElements.forEach(element => {
        revealObserver.observe(element);
    });
}

// Smooth scroll for all links within the page
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});

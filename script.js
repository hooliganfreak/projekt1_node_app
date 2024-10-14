// Globala variabler
const registerUsernameInput = document.getElementById('register-username');
const registerPasswordInput = document.getElementById('register-password');
const usernameValidIcon = document.querySelector('.username-valid-icon');
const usernameInvalidIcon = document.querySelector('.username-invalid-icon');
const passwordValidIcon = document.querySelector('.password-valid-icon');
const passwordInvalidIcon = document.querySelector('.password-invalid-icon');
const registerMsg = document.getElementById('register-message');

const loginUsernameInput = document.getElementById('login-username');
const loginPasswordInput = document.getElementById('login-password');
const loginMsg = document.getElementById('login-message');

// Registrering när man klickar på 'register-form' knappen
document.getElementById('register-form').addEventListener('submit', async (event) => {
    event.preventDefault(); // Gör så att 'register-form' inte submittas direkt

    hideMsg(registerMsg);

    const username = registerUsernameInput.value.trim();
    const password = registerPasswordInput.value.trim();

    if (!checkUsernameValid(username)) {
        displayMsg(registerMsg, 'Username can only contain numbers or letters and must be at least 4 characters long.', true);
        return;
    }

    if (!checkPasswordValid(password)) {
        displayMsg(registerMsg, 'Must be a valid password at least 6 characters long.', true);
        return;
    }

    // Skickar innehållet till /register
    try {
        const result = await sendRequest('http://localhost:3000/register', { username, password });

        if (result.message) {
            displayMsg(registerMsg, result.message, false);
        } else {
            displayMsg(error, result.error, true);
        }
    } catch (error) { // Annan error på server sidan
        console.error('Registration error:', error);
        displayMsg(registerMsg, error.message);
    }
});

// Login när man klickar på 'login-form' knappen
document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault(); // Gör så att 'login-form' inte submittas direkt

    // Variabler
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();

    // Skickar innehållet till /login
    try {
        const result = await sendRequest('http://localhost:3000/login', { username, password });
        localStorage.setItem('jwtToken', result.token);
        localStorage.setItem('refreshToken', result.refreshToken);
        localStorage.setItem('username', result.username);
        window.location.href = 'dashboard.html';
    } catch (error) { 
        displayMsg(loginMsg, error.message, true);
    }
});

async function sendRequest(url, data) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error);
        }

        return result;
    } catch (error) {
        throw error;
    }
}

function displayMsg(element, message, error = true) {
    element.textContent = message;
    element.style.display = 'block';
    element.style.color = error ? 'red' : 'green';
}

function hideMsg(...elements) {
    elements.forEach(element => {
        element.style.display = 'none';
    });
}

// Visar/gömmer ikonen vid registrering om användarnamnet/lösenordet accepteras
const toggleIconDisplay = (input, validIcon, invalidIcon, errorElement, minLength) => {
    const inputLength = input.value.trim().length;
    const username = input.value.trim();

    if (inputLength == 0) {
        hideMsg(errorElement);
        return;
    }

    if (inputLength < minLength) {
        validIcon.style.display = 'none';
        invalidIcon.style.display = 'block';
        displayMsg(errorElement, `Must be at least ${minLength} characters long.`, true);
    } else if (inputLength > 20) {
        validIcon.style.display = 'none';
        invalidIcon.style.display = 'block';
        displayMsg(errorElement, `Can't be more than 20 characters.`, true);
    } else {
        if (checkUsernameValid(username)) {
            validIcon.style.display = 'block';
            hideMsg(invalidIcon, errorElement);
        } else {
            validIcon.style.display = 'none';
            invalidIcon.style.display = 'block';
            displayMsg(errorElement, `Username must contain only letters or numbers.`, true);
        }
    }
}

function checkUsernameValid(username) {
    const usernameRegex = /^[a-zA-Z0-9åäöÅÄÖ]+$/; // Endast siffror eller bokstäver

    if (username.length < 4 || username.length > 20) {
        return false; // Användarnamnet för kort eller för långt
    }

    if (!usernameRegex.test(username)) {
        return false; // Innehåller konstiga karaktärer
    }

    return true;
}

function checkPasswordValid(password) {
    if (password.length < 6 || password.length > 20) {
        return false; // Lösenordet för kort eller för långt
    }

    return true;
}

// ------------------ EVENT LISTENERS ------------------
document.getElementById('show-register').addEventListener('click', function (e) { // "Sign up" knappen
    e.preventDefault();
    hideMsg(usernameValidIcon, passwordValidIcon, usernameInvalidIcon, passwordInvalidIcon, registerMsg);
    registerUsernameInput.value = '';
    registerPasswordInput.value = '';
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('register-section').style.display = 'block';
});

document.getElementById('show-login').addEventListener('click', function (e) { // Lilla "Login" knappen
    e.preventDefault();
    hideMsg(loginMsg);
    loginUsernameInput.value = '';
    loginPasswordInput.value = '';
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('register-section').style.display = 'none';
});

registerUsernameInput.addEventListener('input', () => {
    toggleIconDisplay(registerUsernameInput, usernameValidIcon, usernameInvalidIcon, registerMsg, 4);
});

registerPasswordInput.addEventListener('input', () => {
    toggleIconDisplay(registerPasswordInput, passwordValidIcon, passwordInvalidIcon, registerMsg, 6);
});
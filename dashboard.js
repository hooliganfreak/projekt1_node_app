// Import från websocket.js/utils.js
import { initializeWebSocket, sendWebSocketMessage } from './websocket.js';
import { sessionExpired, hideMsg, showMsg, verifyBoardPassword, selectListItem, showError } from './utils.js';
import { getStickyNotes, addStickyNote } from './note.js';
import { getBoards, createNewBoard } from './board.js';
import {
    newNoteBtn, userContainer, privateCheckbox, dashboardErrorMsg,
    stickyNotesContainer, dashboard, errorMessage, globalUserContainer,
    boardUserContainer, noteErrorMsg, createNewDash,
    passwordContainer, noDashboardMessage, sortTags
} from './globals.js';

// Localstorage 
const username = localStorage.getItem('username');
document.querySelector('.button-container').style.display = "none";

let wsFail = false;
document.addEventListener('DOMContentLoaded', async () => { // Kör denna kod när HTML dokumentet har laddats 
    const welcomeMessage = document.getElementById('welcome-message');
    noDashboardMessage.textContent = "Establishing websocket connection...";
    showMsg(noDashboardMessage);
    const token = localStorage.getItem('jwtToken');

    if (token) { // Om det finns en JWT token
        const valid = await isTokenValid(token); // Checkar om token är valid
        if (!valid) {
            sessionExpired();
            return;
        }

        welcomeMessage.textContent = `Welcome, ${username}!`;

        try {
            await initializeWebSocket(token, username);
        } catch (error) {
            console.error('Failed to initialize WebSocket: ', error);
            wsFail = true;
            handleWebSocketFail();
        }

        document.querySelector('.button-container').style.display = "flex";
        scheduleTokenRefresh(token); // Funktion som refreshar token
        showMsg(userContainer);
        await getBoards(); // Fetchar boards
    } else { // Om det inte finns en JWT token
        window.location.href = 'index.html';
        alert("Unauthorized");
    }
});

// Funktion som checkar om token är valid
async function isTokenValid(token) {
    try {
        const response = await apiFetch('/validate-token', 'POST', null, token);
        return response.valid;
    } catch (error) {
        console.error('Token validation failed:', error);
        return false;
    }
}

// Om vår WebSocket connection inte fungerar
function handleWebSocketFail() {
    const header = userContainer.querySelector('h1');
    header.textContent = 'WebSocket connection failed. You may still use the application without the connection.';
    header.style.border = 'none';
}

// Export funktioner
export function getToken() {
    const token = localStorage.getItem('jwtToken');
    return token;
}

export function isWebSocketFail() {
    return wsFail;
}

export function getGlobalId() {
    return globalBoardId;
}

// Main apiFetch funktion
export async function apiFetch(url, method = 'GET', body = null, token = null) {
    if (!token) { // Om det inte finns en token, hämta från localStorage
        token = localStorage.getItem('jwtToken');
    }

    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);

        if (response.status === 222) { // Kod för sessionExpired
            sessionExpired();
            throw new Error("Session expired");
        }

        if (response.status === 403) { // Kod för unauthorized
            throw new Error('unauthorizedDeletion');
        }

        if (!response.ok) {
            const errorText = await response.text();

            throw new Error(errorText);
        }

        return await response.json();
    } catch (error) {
        if (error.message === 'unauthorizedDeletion') {
            errorHandler('unauthorizedDeletion');
        } else {
            console.error("apiFetch failed: ", error);
            errorHandler('apiFetchFail');
        }
        throw error;
    }
}

let showingDashboard = false;
let globalBoardId; // Används för att hålla redan på vilken board som är vald
// Dashboard för en specifik board
export async function loadDashboard(board, loggedInUser) {
    const isPrivate = board.isPrivate;
    const boardId = board.id;
    globalBoardId = boardId;
    let boardToken = localStorage.getItem(`board_${boardId}_access`);

    try {
        const stickyNotesOnThisBoard = board.stickyNotes.length;
        const boardCreatorId = board.userId;
        const loggedInUserId = loggedInUser.userId;
        const isBoardCreator = boardCreatorId === loggedInUserId;

        // Om boarden är privat och vi inte är skaparen, be om lösenord
        if (isPrivate && !boardToken && !isBoardCreator) {
            const isPasswordCorrect = await verifyBoardPassword(boardId); // Be om ett lösenord
            if (!isPasswordCorrect) {
                return; // Exit om fel lösenord
            } else {
                // Uppdatera ikonen för att visa att vi har tillgång till boarden
                const listItem = document.querySelector(`[data-id="${boardId}"] .lock-icon`);
                listItem.textContent = '✔️';
                boardToken = localStorage.getItem(`board_${boardId}_access`); // Hämtar token som skapats då vi fått tillgång till nån annans privata board

                scheduleTokenRefresh(boardToken, true, boardId)
            }
        }

        await apiFetch(`/get-board-details`, 'POST', { boardId, isPrivate, isBoardCreator }, boardToken);

        // Ändra designen
        dashboard.classList.add('move-left');
        showMsg(stickyNotesContainer, newNoteBtn);
        showingDashboard = true;

        // Denna funktion visar vilken board som är vald
        selectListItem(boardId);

        if (wsFail) { // Om wsFail är true -> WS fungerar inte
            hideMsg(userContainer);
            if (stickyNotesOnThisBoard == 0) { // Om det inte finns någå stickyNotes i boarden, skippa getStickyNotes api call
                errorHandler('noStickyNotes');
                return;
            }
            await getStickyNotes(globalBoardId);
            showingDashboard = true;
            return;
        }

        if (!wsFail) await sendWebSocketMessage(boardId, 'connectBoard');
        hideMsg(globalUserContainer);
        showMsg(boardUserContainer);

        if (stickyNotesOnThisBoard == 0) {// Om det inte finns någå stickyNotes i boarden, skippa getStickyNotes api call
            errorHandler('noStickyNotes');
            return;
        } else {
            await getStickyNotes(globalBoardId); // Fetch sticky notes for this dashboard
        }
    } catch (error) {
        console.error(error);
        errorHandler('loadDashboardFailed');
    }
}

export function displayUsers(users) { // Visar WebSocket connected användare
    const userList = document.getElementById('board-user-list');

    if (users.length === 0) {
        return;
    }
    userList.innerHTML = ''; // Tömmer listan

    users.forEach(user => { // För varje användare, skapa ett <li> element som fyller listan
        const listItem = document.createElement('li');
        listItem.textContent = user === username ? user + " (you)" : user;
        userList.appendChild(listItem);
    });
}

// ----------------------- EVENT LISTENERS och andra funktioner -----------------------
document.getElementById('logout-btn').addEventListener('click', () => { // 'Logout' knappen
    localStorage.clear();
    window.location.href = 'index.html';
});

document.getElementById('create-new-btn').addEventListener('click', () => { // 'Create new' knappen
    hideMsg(dashboard, stickyNotesContainer, newNoteBtn, errorMessage);
    document.getElementById('dash-name').value = '';
    document.getElementById('dash-tag').value = '';
    document.getElementById('board-password').value = '';
    privateCheckbox.checked = false;

    privateCheckbox.dispatchEvent(new Event('change'));
    showMsg(createNewDash);
});

newNoteBtn.addEventListener('click', () => { // 'New note' knappen
    showMsg(document.getElementById('note-popup'));
    document.getElementById('note-name').value = '';
    document.getElementById('note-color').value = '#FFFFFF';
})

document.getElementById('cancel-btn').addEventListener('click', () => { // 'Cancel' knappen i 'Create a new note'
    hideMsg(document.getElementById('note-popup'));
})

document.getElementById('create-new-note-btn').addEventListener('click', async () => { // 'Create' knappen i 'Create a new note'
    const noteName = document.getElementById('note-name').value; // Valt note namn
    const noteColor = document.getElementById('note-color').value; // Vald färg

    if (!noteName.trim()) { // Om namnet på noten är en tom sträng
        noteErrorMsg.textContent = "Note must have a name."
        showError(noteErrorMsg);
        return;
    }

    await addStickyNote(noteName, noteColor, globalBoardId); // Kör addStickyNote 
})

document.getElementById('create-new-btn-final').addEventListener('click', async (event) => { // 'Create new' final button
    event.preventDefault();
    await createNewBoard(showingDashboard);
});

document.getElementById('back-btn').addEventListener('click', async () => { // 'Back' knappen
    if (showingDashboard) {
        showMsg(stickyNotesContainer, newNoteBtn);
        hideMsg(createNewDash);
        dashboard.classList.add('move-left');
        dashboard.style.display = 'flex';
    } else {
        dashboard.classList.remove('move-left');
        dashboard.style.display = 'flex';
        hideMsg(createNewDash);
        await getBoards();
    }
});

document.getElementById('sort-btn').addEventListener('click', () => { // 'Sort list' knappen
    const tagOption = document.getElementById('tag');
    const listItemTags = document.querySelectorAll('#list-tag');
    hideMsg(sortTags);

    if (listItemTags.length === 0) {
        hideMsg(tagOption, sortTags);
    } else {
        showMsg(tagOption);
    }
    showMsg(document.getElementById('sort-popup'));
});

document.getElementById('close-popup-btn').addEventListener('click', () => { // 'Cancel' knappen
    hideMsg(document.getElementById('sort-popup'));
});

document.querySelectorAll('input[name="sortOption"]').forEach(option => { // 'Sort' alternativen
    option.addEventListener('change', (e) => {
        if (e.target.value === 'tag') { // Om 'By Tag' är valt, visa sortTags
            showMsg(sortTags);
        } else { // Annors visar vi inte sortTags
            hideMsg(sortTags);
        }
    });
});

privateCheckbox.addEventListener('change', () => { // Om man markerar boarden som privat
    if (privateCheckbox.checked) {
        showMsg(passwordContainer);
        createNewDash.style.height = '280px';
        document.getElementById('board-password').value = '';
    } else {
        hideMsg(passwordContainer, errorMessage);
        createNewDash.style.height = 'auto';
    }
});

// Hämtar tiden när token går ut
function getTokenExpiration(token) {
    const tokenPayload = JSON.parse(atob(token.split('.')[1])); // Decode JWT tokens innehåll
    return tokenPayload.exp * 1000; // Konverterar expiration time till millisekunder
}

// Funktion som automatiskt uppdaterar token med en refreshtoken när den är nära på att gå ut
function scheduleTokenRefresh(accessToken, isBoardToken = false, boardId = null) { // Funktion som körs 5 minuter före token går ut
    const expirationTime = getTokenExpiration(accessToken);
    const timeUntilExpiration = expirationTime - Date.now();

    // 5 minuter före expiration av token
    const refreshTime = timeUntilExpiration - 5 * 60 * 1000;

    if (refreshTime <= 0) {
        refreshToken(accessToken, isBoardToken, boardId);  // refreshar genast om refreshTime är i dåtiden
        return;
    }

    setTimeout(async () => { // Beroende på om scheduleTokenRefresh körs från login eller loadDashboard
        let refreshToken = localStorage.getItem(isBoardToken ? `board_${boardId}_refresh_access` : 'refreshToken');

        const apiUrl = isBoardToken
            ? '/refresh-board-token'
            : '/refresh-token';

        const body = isBoardToken ? { boardId } : null;

        try {
            const data = await apiFetch(apiUrl, 'POST', body, refreshToken);

            if (data.success) {
                const newAccessToken = data.accessToken;

                if (isBoardToken) {
                    localStorage.setItem(`board_${boardId}_access`, newAccessToken);
                    scheduleTokenRefresh(newAccessToken, true, boardId); // Re-schedule board token
                } else {
                    localStorage.setItem('jwtToken', newAccessToken);
                    scheduleTokenRefresh(newAccessToken); // Re-schedule login token
                }
            }
        } catch (error) {
            console.error('Failed to refresh token.', error);
            sessionExpired();
        }
    }, refreshTime);
}

// Errohandler för diverse errors
export function errorHandler(context = '', errorElement = null) {
    switch (context) {
        case 'noBoardsInDashboard':
            showMsg(noDashboardMessage);
            noDashboardMessage.textContent = "No dashboards available."
            dashboard.classList.remove('move-left');
            hideMsg(stickyNotesContainer);
            break;
        case 'failedToFetchBoards':
            dashboardErrorMsg.textContent = 'Failed to fetch boards.';
            showError(dashboardErrorMsg);
            break;
        case 'unauthorizedDeletion':
            document.getElementById('custom-popup').remove();
            dashboardErrorMsg.textContent = "Only the creator can delete this board!";
            showError(dashboardErrorMsg);
            break;
        case 'apiFetchFail':
            dashboardErrorMsg.textContent = 'Something went wrong fetching the data.';
            errorMessage.textContent = 'Something went wrong fetching the data.';
            showError(dashboardErrorMsg, errorMessage);
            console.error('Something went wrong fetching the data.')
            break;
        case 'loadDashboardFailed':
            dashboardErrorMsg.textContent = 'Failed to fetch board details.'
            showError(dashboardErrorMsg);
            break;
        case 'failedToCreateNote':
            noteErrorMsg.textContent = 'Failed to create note.'
            showError(noteErrorMsg);
            break;
        case 'noStickyNotes':
            stickyNotesContainer.innerHTML = '';
            const stickyNotesErrorMsg = document.createElement('p');
            stickyNotesErrorMsg.className = "sticky-container-error-msg";
            stickyNotesErrorMsg.innerText = "This dashboard has no sticky-notes yet.";
            stickyNotesContainer.appendChild(stickyNotesErrorMsg);
            break;
        case 'failedToUpdateNote':
            dashboardErrorMsg.textContent = 'Failed to update sticky note data.'
            showError(dashboardErrorMsg);
            break;
        case 'failedToDeleteNote':
            dashboardErrorMsg.textContent = 'Failed to delete note.'
            showError(dashboardErrorMsg);
            break;
        default:
            if (errorElement) {
                errorElement.textContent = "An unknown error occured.";
                showMsg(errorElement);
            }
            console.error('Unhandled error context: ', context);
            break;
    }
}
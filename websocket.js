import { displayUsers } from './dashboard.js';
import { getBoards } from './board.js';
import { getStickyNotes } from './note.js';

// Funktion som initialiserar WebSocket connection
let socket;
export async function initializeWebSocket(token, username) {
    return new Promise((resolve, reject) => {
        const webSocketUrl =  `wss://${window.location.hostname}:3001/?access_token=${token}&user=${username}`;

        socket = new WebSocket(webSocketUrl);

        socket.onopen = () => {
            console.log(`WebSocket connection established by user ${username}`);
            resolve();
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('Received message:', data);
            handleUpdates(data);
        }

        socket.onclose = () => {
            console.log(`WebSocket connection closed`);
        }

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            reject(new Error('WebSocket connection error'));
        };
    })
}

// Skickar ett WebSocket meddelande
export async function sendWebSocketMessage(id, action, data = {}) {
    const message = {
        id: id,
        action: action,
        ...data,
    };

    socket.send(JSON.stringify(message));
}

// Funktion som tar emot uppdateringar från WebSocket servern och visar dem
export function handleUpdates(data) {
    switch (data.action) {
        case 'updatePosition':
            updateStickyNotePositionUI(data);
            break;
        case 'updateContent':
            updateStickyNoteContentUI(data);
            break;
        case 'updateTitle':
            updateStickyNoteTitleUI(data);
            break;
        case 'editDimensions':
            updateStickyNoteDimensionsUI(data);
            break;
        case 'deleteNote':
            deleteStickyNoteUI(data);
            break;
        case 'createNote':
            getStickyNotes(data.boardId);
            break;
        case 'deleteBoard':
            deleteBoardUI(data);
            break;
        case 'createBoard':
            getBoards();
            break;
        case 'connectedUsersList':
            displayUsers(data.users);
            break;
        case 'userJoined':
            console.log(`${data.message}`);
            displayUsers(data.users);
            break;
        case 'userLeft':
            console.log(`${data.message}`);
            displayUsers(data.users);
            break;
        case 'globalUserListUpdate':
            updateGlobalUserList(data.users);
            break;
        default:
            console.error('Unknown action:', data.action);
            break;
    }
}

// Denna funktion tar emot data från websocket meddelandet och uppdaterar sticky-notens position
export function updateStickyNotePositionUI(data) {
    const stickyNote = document.querySelector(`.sticky-note[data-id='${data.id}']`);

    if (stickyNote) {
        stickyNote.style.left = data.positionX + 'px';
        stickyNote.style.top = data.positionY + 'px';
    } else {
        console.error(`Sticky note with data-id ${data.id} not found.`);
    }
}

// Uppdaterar content
export function updateStickyNoteContentUI(data) {
    const stickyNote = document.querySelector(`.sticky-note[data-id='${data.id}']`);
    if (stickyNote) {
        stickyNote.querySelector('.sticky-note-content').textContent = data.content;
    } else {
        console.error(`Sticky note with data-id ${data.id} not found.`);
    }
}

// Uppdaterar rubriken
export function updateStickyNoteTitleUI(data) {
    const stickyNote = document.querySelector(`.sticky-note[data-id='${data.id}']`);
    if (stickyNote) {
        stickyNote.querySelector('h1').textContent = data.title;
    } else {
        console.error(`Sticky note with data-id ${data.id} not found.`);
    }
}

// Raderar noten
export function deleteStickyNoteUI(data) {
    const stickyNote = document.querySelector(`.sticky-note[data-id='${data.id}']`);

    if (stickyNote) {
        stickyNote.remove();

        const notes = document.querySelectorAll('.sticky-note');
        if (notes.length === 0) {
            getStickyNotes(data.boardId);
        }
    } else {
        console.error(`Sticky note with data-id ${data.id} not found.`);
    }
}

// Raderar boarden
export function deleteBoardUI(data) {
    const boardElement = document.querySelector(`.board-cross[data-id='${data.boardId}']`);

    if (boardElement) {
        boardElement.remove(); 

        const boards = document.querySelectorAll('.board-cross');
        if (boards.length === 0) {
            getBoards();
        }
    } else {
        console.warn('Board element not found for id:', data.id);
    }
}

// Uppdaterar storleken på noten
export function updateStickyNoteDimensionsUI(data) {
    const stickyNote = document.querySelector(`.sticky-note[data-id='${data.id}']`);
    if (stickyNote) {
        stickyNote.style.width = data.width + 'px';
        stickyNote.style.height = data.height + 'px';
    } else {
        console.error(`Sticky note with data-id ${data.id} not found.`);
    }
}

// Uppdaterar listan på connected WebSocket användare
function updateGlobalUserList(users) {
    const globalUserListElement = document.getElementById('global-user-list');
    globalUserListElement.innerHTML = ''; 

    if (users.length === 0) {
        globalUserListElement.innerHTML = '<li>No users connected globally.</li>';
        return;
    }

    users.forEach(username => {
        const listItem = document.createElement('li');
        listItem.textContent = username; 
        globalUserListElement.appendChild(listItem); 
    });
}
import { errorHandler, isWebSocketFail, getGlobalId, apiFetch } from './dashboard.js';
import { updateStickyNotePosition, updateStickyNoteDimensions, deleteStickyNote} from './note.js';
import { sendWebSocketMessage } from './websocket.js';
import { stickyNotesContainer } from './globals.js';

// Funktion som generera element (används i board.js och note.js)
export function createElement(type, className = '', textContent = '', editable = false) {
    const element = document.createElement(type);
    if (className) {
        element.classList.add(className);
    }
    if (textContent) {
        element.textContent = textContent;
    }
    if (editable){
        element.contentEditable = true;
    }
    return element;
}

// Skapar litan över boards (används i board.js)
export function createBoardListItem(board, onRemove, onClick, loggedInUser) {
    const listItem = createElement('li', 'board-cross');
    listItem.dataset.id = board.id;
    const textContent = createElement('p', '', board.tag === '' ? board.name : `${board.name} #${board.tag}`);
    listItem.appendChild(textContent);

    const infoDiv = createElement('div', 'info-div');
    const creatorName = createElement('p', 'board-creator', board.user.username);
    infoDiv.appendChild(creatorName);

    const cross = createElement('span', 'board-remove', 'X');
    cross.addEventListener('click', (event) => { // Lägger till delete funktion till kryssen i listan
        event.stopPropagation();
        onRemove(board.id);
    });

    const loggedInUserId = loggedInUser.userId;
    const boardCreator = board.userId;
    const isBoardCreator = loggedInUserId === boardCreator;
    let privateSymbol = null;

    if (isBoardCreator && board.isPrivate) { // Ikonen är alltid ✔️ om du har gjort boarden (du har alltid tillgång)
        privateSymbol = createElement('span', 'lock-icon', '✔️');
    } else if (!isBoardCreator && board.isPrivate) { // Ikonen är ✔️ om du har tillgång, och 🔒 om du inte har
        privateSymbol = createElement('span', 'lock-icon', localStorage.getItem(`board_${board.id}_access`) ? '✔️' : '🔒');
    } else { // Annors skapa en tom ikon 
        privateSymbol = createElement('span', 'lock-icon');
    }

    infoDiv.appendChild(privateSymbol);
    infoDiv.appendChild(cross);
    listItem.appendChild(infoDiv);
    listItem.addEventListener('click', (event) => { // Lägger till click funktion till hela <li> elementet
        event.stopPropagation();
        onClick(board.id);
        selectListItem(board.id);
    });

    return listItem;
}

// Skapar en delete knapp (används i note.js)
export function createDeleteButton(noteId) {
    const deleteButton = createElement('span', '', 'X');
    deleteButton.addEventListener('click', async (event) => {
        event.stopPropagation();
        await deleteStickyNote(noteId);
    });
    return deleteButton;
}

// Skapar en spacer (används i note.js)
export function createSpacer(stickyNote, noteId) {
    const spacer = createElement('div', 'sticky-note-spacer');
    spacer.addEventListener('mousedown', (e) => mouseDown(e, stickyNote, noteId)); // Lägger till mouseDown funktionalitet så man kan flytta på noten
    return spacer;
}

// Skapar en footer (används i note.js)
export function createFooterElements(note) {
    const creator = createElement('p', '', `Created by: ${note.user.username}`);
    const formattedDate = formatDate(note.updatedAt);
    const edited = createElement('p', '', `Edited: ${formattedDate}`);
    return [creator, edited];
}

// Skapar ett resize element (används i note.js) Hjälp från ChatGPT
export function createResizableDiv(stickyNote, noteId) {
    const resizer = createElement('div', 'resizer');

    // Räknar ut nya dimensioner på noten och applicerar dem
    resizer.addEventListener('mousedown', (e) => { 
        e.preventDefault();
        let originalWidth = stickyNote.offsetWidth;
        let originalHeight = stickyNote.offsetHeight;
        let originalMouseX = e.clientX;
        let originalMouseY = e.clientY;

        const resize = (e) => { // Ny position
            let newWidth = originalWidth + (e.clientX - originalMouseX);
            let newHeight = originalHeight + (e.clientY - originalMouseY);
            
            // Max storlek
            newWidth = Math.max(250, Math.min(newWidth, 415));
            newHeight = Math.max(110, Math.min(newHeight, 265));

            stickyNote.style.width = `${newWidth}px`;
            stickyNote.style.height = `${newHeight}px`;

            if (!isWebSocketFail()) {
                let globalBoardId = getGlobalId()
                const wsData = {
                    width: newWidth,
                    height: newHeight,
                    boardId: globalBoardId
                };
                sendWebSocketMessage(noteId, 'editDimensions', wsData);
            }
        };
        // När man släpper musen, sluta ändra på storleken
        const stopResize = async () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResize);
            try {
                await updateStickyNoteDimensions(noteId, stickyNote.style.width, stickyNote.style.height);
            } catch (error) {
                console.error('Failed to update the dimensions.');
                errorHandler('failedToUpdateNote');
            }
        };

        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResize);
    });

    return resizer;
}

function formatDate(dateString) {
    const date = new Date(dateString);

    const day = String(date.getDate()).padStart(2, '0'); // 2 -> 02
    const month = String(date.getMonth() + 1); // Month är 0-11
    const year = String(date.getFullYear()).slice(-2); // 2024 -> 24
    const hours = String(date.getHours()).padStart(2, '0'); // 9 -> 09
    const minutes = String(date.getMinutes()).padStart(2, '0'); // 5 -> 05

    return `${day}/${month}/${year} ${hours}:${minutes}`; // Returnerar en string med formatet DD/MM/YY HH:MM
}

// Om token är expired
export function sessionExpired() {
    document.body.innerHTML = '';

    const expiryContainer = document.createElement('div');

    const message = document.createElement('h1');
    message.className = 'expiry-message';
    message.textContent = 'Session expired. Please log in again.';

    const button = document.createElement('button');
    button.className = 'expiry-button';
    button.innerText = 'Log in'

    button.addEventListener('click', () => {
        window.location.href = 'index.html';
    })

    expiryContainer.appendChild(message);
    expiryContainer.appendChild(button);
    document.body.appendChild(expiryContainer);
    localStorage.clear();
}

export function hideMsg(...elements) {
    elements.forEach(element => {
        element.style.display = 'none';
    });
}

export function showMsg(...elements) {
    elements.forEach(element => {
        element.style.display = 'block';
    });
}

// Skapar en popup
export function createPopup(content, confirm) {
    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.id = 'custom-popup';

    const popupContent = document.createElement('div');
    popupContent.className = 'popup-content';
    popupContent.innerHTML = content;

    const cancelButton = createButton('Cancel', 'cancel-button', () => {
        popup.remove(); // Cancel knappen gör ingenting
    });

    const confirmButton = createButton('Confirm', 'confirm-button', () => {
        confirm();
        popup.remove();
    });

    popupContent.appendChild(confirmButton);
    popupContent.appendChild(cancelButton);
    popup.appendChild(popupContent);
    document.body.appendChild(popup);
    showMsg(popup);
}

// Skapar en knapp, används i popup
function createButton(text, className, onClick) {
    const button = document.createElement('button');
    button.textContent = text;
    button.className = className;

    button.addEventListener('click', onClick);

    return button;
}

// Gör sticky-notes rörliga
// https://www.youtube.com/watch?v=_NFdUC2W0W4
let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;
let stickyNoteBeingDragged = null;
let newPositionTop = null;
let newPositionLeft = null;
let noteId = null;

// Körs när man rör spacern i sticky-note headern
function mouseDown(e, stickyNote, note_Id) {
    e.preventDefault();

    // Start positionen för musen
    startX = e.clientX;
    startY = e.clientY;

    // Start positionen för sticky-notes
    initialLeft = parseInt(stickyNote.style.left);
    initialTop = parseInt(stickyNote.style.top);

    // När en sticky-note aktivt blir förflyttad
    stickyNoteBeingDragged = stickyNote;

    // Sparar noteId
    noteId = note_Id;

    // Lägge till eventListerners till dokumentet
    document.addEventListener('mousemove', mouseMove);
    document.addEventListener('mouseup', mouseUp);
}

function mouseMove(e) {
    e.preventDefault();
    // Om en sticky-note inte blir förflyttad, ignorera denna kod
    if (!stickyNoteBeingDragged) return;

    // Beräkna förändringen i musens position, musens nya position - musens startposition
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    // Beräkna ny position för sticky-noten, originell position + förändringen
    let newLeft = initialLeft + deltaX;
    let newTop = initialTop + deltaY;

    // stickyNotesContainer dimensioner
    const containerRect = stickyNotesContainer.getBoundingClientRect();

    // Hjälp med ChatGPT <-------!!!!
    // Left är 0 vid den vänstra kanten av sticky-container
    if (newLeft < 0) newLeft = 0; // Kan inte föras utanför sticky-container

    // Left + bredden på stickyNoteBeingDragged kan inte vara större än bredden på stickyNotesContainer
    // Om det händer så är newLeft bredden på sticky-container - sticky-note bredd
    if (newLeft + stickyNoteBeingDragged.offsetWidth > containerRect.width) {
        newLeft = containerRect.width - stickyNoteBeingDragged.offsetWidth;
    }

    // Top är 0 vid den övre kanten av sticky-container
    if (newTop < 0) newTop = 0; // Kan inte föras utanför sticky-containern

    // Left + höjden på stickyNoteBeingDragged kan inte vara större än höjden på stickyNotesContainer
    // Om det händer så är newTop höjden på sticky-container - sticky-note höjd
    if (newTop + stickyNoteBeingDragged.offsetHeight > containerRect.height) {
        newTop = containerRect.height - stickyNoteBeingDragged.offsetHeight;
    }

    // Uppdatera den nya positionen enligt restriktionerna ovan
    stickyNoteBeingDragged.style.left = newLeft + 'px';
    stickyNoteBeingDragged.style.top = newTop + 'px';

    // Spara den nya positionen för användning i updateStickyNotePosition funktionen
    newPositionLeft = newLeft;
    newPositionTop = newTop;

    if (!isWebSocketFail()) {
        let globalBoardId = getGlobalId()
        const wsData = {
            positionX: newPositionLeft,
            positionY: newPositionTop,
            boardId: globalBoardId
        }
        sendWebSocketMessage(noteId, 'updatePosition', wsData);
    }
}

async function mouseUp(e) {
    e.preventDefault();
    // Om en sticky-note inte blir förflyttad, ignorera denna kod
    if (!stickyNoteBeingDragged) return;

    try {
        await updateStickyNotePosition(noteId, newPositionLeft, newPositionTop); // Sparar positonen i db
    } catch (error) {
        console.error(error);
        errorHandler('failedToUpdateNote');
    }

    // Tar bort eventlisteners när man slutar förflytta sticky-note
    document.removeEventListener('mousemove', mouseMove);
    document.removeEventListener('mouseup', mouseUp);

    stickyNoteBeingDragged = null; // Återställer vilken note som blir förflyttad
    newPositionLeft = null; // Återställer X
    newPositionTop = null; // Återställer Y
    noteId = null; // Återställer noteId
}

// Verifierar att man faktiskt vill radera någonting
export async function verifyDelete(type) {
    return new Promise((resolve) => {
        const message = type === 'board'
            ? "<p>Are you sure you want to delete this board and all its associated notes?</p>"
            : "<p>Are you sure you want to delete this note?</p>";
        // När man klickar på "Confirm" -> resolve(true), "Cancel" -> resolve(false)
        createPopup(message, () => resolve(true), () => resolve(false));
    });
}

// Verifierar lösenordet till en board
export async function verifyBoardPassword(boardId) {
    return new Promise((resolve) => {
        const passwordPopupContent = `
            <h2>Please enter the board password:</h2>
            <input type="password" id="dashboard-password-input">
            <div id="popup-error-message" class="error-message"></div>
        `;

        // Skapar en popup
        createPopup(passwordPopupContent, async () => {
            const passwordElement = document.getElementById('dashboard-password-input');
            const password = passwordElement.value;

            if (!password.trim()) {  // Om lösenordet är tomt
                document.getElementById('popup-error-message').textContent = "Please enter a password.";
                showError(document.getElementById('popup-error-message'));
                return;  
            }

            try { // Frågar servern om lösenordet är rätt
                const passwordResponse = await apiFetch(`/verify-board-password`, 'POST', { boardId, password });
                if (!passwordResponse.success) {
                    document.getElementById('popup-error-message').textContent = "Incorrect password.";
                    showError(document.getElementById('popup-error-message'));
                    return;
                }

                // Sparar board tokens i localStorage
                localStorage.setItem(`board_${boardId}_access`, passwordResponse.boardToken);
                localStorage.setItem(`board_${boardId}_refresh_access`, passwordResponse.boardRefreshToken);
                document.getElementById('custom-popup').remove();
                resolve(true);
            } catch (error) {
                console.error(error);
                errorHandler('apiFetchFail');
            }
        });
    });
}

// Funktion som håller reda på vilken board som är vald
let selectedListItemId = null;
export function selectListItem(boardId) {
    if (selectedListItemId) { // Hittar den förra valda boarden och tar bort 'selected' klassen från den
        const previouslySelected = document.querySelector(`[data-id="${selectedListItemId}"]`);
        if (previouslySelected) {
            previouslySelected.classList.remove('selected');
        }
    }

    // Uppdaterar den nuvarande valda boarden
    selectedListItemId = boardId;

    // Lägger till 'selected' klassen till den nya valda boarden
    const newSelected = document.querySelector(`[data-id="${boardId}"]`);
    if (newSelected) {
        newSelected.classList.add('selected');
    }
}

// Visar errors i 5 sekunder
export function showError(element) {
    if (element) {
        element.style.display = 'block';
        setTimeout(() => {
            element.style.display = 'none'; 
        }, 5000); 
    }
}
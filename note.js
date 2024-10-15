import {
    createElement, createDeleteButton, createSpacer, createFooterElements, 
    createResizableDiv, hideMsg, verifyDelete, 
} from './utils.js';
import { apiFetch, errorHandler, isWebSocketFail, getGlobalId } from './dashboard.js';
import { stickyNotesContainer } from './globals.js';
import { sendWebSocketMessage } from './websocket.js';

let globalBoardId = null;
// Sticky-notes template: https://medium.com/@sharathchandark/how-to-create-sticky-note-app-in-html-css-javascript-mini-text-editor-910beec75a48
// Funktion som skapar en sticky note
export async function addStickyNote(noteName, noteColor, boardId) {
    globalBoardId = getGlobalId();
    try {
        const data = await apiFetch('/create-sticky-note', 'POST', { noteName, noteColor, boardId });

        if (!isWebSocketFail()) {
            const wsData = {
                name: data.stickyNote.noteName,
                color: data.stickyNote.noteColor,
                boardId: globalBoardId,
            };

            sendWebSocketMessage(data.stickyNote.id, 'createNote', wsData);
        }

        hideMsg(document.getElementById('note-popup'));
        await getStickyNotes(globalBoardId);
    } catch (error) {
        console.error("Failed to create sticky-note. ", error);
        errorHandler('failedToCreateNote');
    }
}

// Skapar en header
function createHeader(note, title, stickyNote) {
    const header = createElement('div', 'sticky-note-header');
    header.appendChild(title);
    header.appendChild(createSpacer(stickyNote, note.id));
    header.appendChild(createDeleteButton(note.id));
    return header;
}

// Skapar en footer
function createFooter(note) {
    const footer = createElement('div', 'sticky-note-footer');
    const [creator, edited] = createFooterElements(note);
    footer.appendChild(creator);
    footer.appendChild(edited);
    return footer;
}

// Skapar innehållet (texten)
function createContent(note, globalBoardId) {
    const content = createElement('p', 'sticky-note-content', note.noteText || "Text here...", true);
    content.addEventListener('input', () => {
        if (!isWebSocketFail()) {
            const wsData = {
                content: content.textContent,
                boardId: globalBoardId,
            };
            sendWebSocketMessage(note.id, 'updateContent', wsData);
        }
    });
    return content;
}

// Skapar rubriken
function createTitle(note, globalBoardId) {
    const title = createElement('h1', '', note.noteName || 'Title', true);
    title.addEventListener('input', () => {
        if (!isWebSocketFail()) {
            const wsData = {
                title: title.textContent,
                boardId: globalBoardId
            };
            sendWebSocketMessage(note.id, 'updateTitle', wsData);
        }
    });
    return title;
}

// Skapar själva noten
function createStickyNoteElement(note) {
    const stickyNote = createElement('div', 'sticky-note');
    stickyNote.dataset.id = note.id;
    stickyNote.style.backgroundColor = note.noteColor;
    stickyNote.style.left = `${note.positionX}px`;
    stickyNote.style.top = `${note.positionY}px`;
    stickyNote.style.width = `${note.width}px`;
    stickyNote.style.height = `${note.height}px`;
    return stickyNote;
}

// Genererar alla notes
function displayNotes(notes) {
    globalBoardId = getGlobalId();
    notes.forEach(note => {
        const stickyNote = createStickyNoteElement(note);
        const title = createTitle(note, globalBoardId);
        const header = createHeader(note, title, stickyNote);
        const footer = createFooter(note);
        const content = createContent(note, globalBoardId);
        const resizer = createResizableDiv(stickyNote, note.id);

        const updateStickyNote = async () => { // Funkion som uppdaterar rubriken och texten
            const newName = title.textContent.trim() || 'Title';
            const newText = content.textContent;
            try {
                await updateStickyNoteContent(note.id, newName, newText);
            } catch (error) {
                console.error(error);
                errorHandler('failedToUpdateNote');
            }
        };

        // Update sticky note körs när ändringar gjorts till title/header och de tappar fokus
        title.addEventListener('blur', updateStickyNote);
        content.addEventListener('blur', updateStickyNote);

        stickyNote.appendChild(header);
        stickyNote.appendChild(content);
        stickyNote.appendChild(footer);
        stickyNote.appendChild(resizer);
        stickyNotesContainer.appendChild(stickyNote);
    });
}

let previousNotes = [];
// Main funktion som hämtar alla sticky notes från databasen
export async function getStickyNotes(boardId) {
    // Tömmer container före vi refreshar notes
    stickyNotesContainer.innerHTML = '';
    try { // Fetchar notes som hör till denna boardId
        const notes = await apiFetch(`/notes/${boardId}`, 'GET', null);

        if (notes.length === 0) {
            errorHandler('noStickyNotes');
            return;
        }

        // Om inga ändringar gjorts, skippa displayNotes
        if (JSON.stringify(notes) === JSON.stringify(previousNotes)) {
            return; 
        }

        // Tömmer container före vi refreshar notes
        stickyNotesContainer.innerHTML = '';

        displayNotes(notes);
    } catch (error) {
        console.error("Failed to fetch sticky-notes. ", error);
        errorHandler('failedToFetchNotes');
    }
}

// Funktion för att uppdatera sticky-note position i db
export async function updateStickyNotePosition(noteId, newPositionX, newPositionY) {
    try {
        await apiFetch(`/notes_position/${noteId}`, 'PATCH', { newPositionX, newPositionY });
    } catch {
        console.error("Failed to update sticky-note position.");
        errorHandler('failedToUpdateNote');
    }
}

// Funktion för att uppdatera innehållet i sticky-note
async function updateStickyNoteContent(noteId, newName, newText) {
    globalBoardId = getGlobalId();
    try {
        await apiFetch(`/notes_content/${noteId}`, 'PATCH', { newText, newName });

        await getStickyNotes(globalBoardId); // Om det fungerade, refresha sticky-notes
    } catch (error) {
        console.error("Failed to update sticky-note content.", error);
        errorHandler('failedToUpdateNote');
    }
}

// Funktion för att radera en sticky-note
export async function deleteStickyNote(noteId) {
    const confirmed = await verifyDelete('note');
    
    if (confirmed) { // Om man klickar på "Confirm"
        globalBoardId = getGlobalId();
        try {
            const response = await apiFetch(`/notes_delete/${noteId}`, 'DELETE', null);

            if (response.success) { 
                const boardId = globalBoardId; 
                document.getElementById('custom-popup').remove();
                if (!isWebSocketFail()) sendWebSocketMessage(noteId, 'deleteNote', { boardId });

                await getStickyNotes(boardId); 
            } else {
                console.error("Delete operation unsuccessful."); 
                errorHandler("failedToDeleteNote"); 
            }
        } catch (error) {
            console.error("Failed to delete note: ", error); 
            errorHandler("failedToDeleteNote"); 
        }
    }
}

// Funktion för att uppdatera sticky note dimensioner
export async function updateStickyNoteDimensions(noteId, newWidth, newHeight) {
    try {
        await apiFetch(`/notes_dimensions/${noteId}`, 'PATCH', { newWidth, newHeight });

    } catch {
        console.error("Failed to update sticky-note dimensions.");
        errorHandler('failedToUpdateNote');
    }
}
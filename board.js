// Importerar funktioner
import { sendWebSocketMessage } from './websocket.js';
import { apiFetch, errorHandler, loadDashboard, isWebSocketFail, getGlobalId } from './dashboard.js';
import { verifyDelete, hideMsg, createBoardListItem, createElement, showMsg, selectListItem, showError } from './utils.js';
import {
    dashboardList, sortTags, sortBtn, confirmationBox, noDashboardMessage,
    dashboardErrorMsg, newNoteBtn, createNewDash, privateCheckbox, errorMessage,
    dashboard, stickyNotesContainer
} from './globals.js';

let selectedListItemId = null;
let sortBy;
// Main getBoards funktion som hämtar alla boards 
export async function getBoards(sortBy = 'default', selectedTag = "") {
    // Tömmer innehållet så att varje gång getBoards körs så uppdateras listan
    dashboardList.innerHTML = '';
    sortTags.innerHTML = '';
    sortBtn.style.display = "none";
    confirmationBox.style.display = "none";

    // Fetchar /boards 
    try {
        const response = await apiFetch('http://localhost:3000/boards', 'GET', null);
        const boards = response.boards;
        const loggedInUser = response.loggedInUser;

        hideMsg(noDashboardMessage, dashboardErrorMsg, newNoteBtn); // Gömmer errormeddelanden
        selectBoards(boards, sortBy, selectedTag, loggedInUser); // Kör selectBoards
    } catch (error) { // Om 'try' misslyckas
        console.error(error);
        errorHandler('failedToFetchBoards');
    }
}

// Funktion som sorterar boards enligt valda parametrar
function selectBoards(boards, sortBy, selectedTag, loggedInUser) {
    // Om det inte finns nån board
    if (boards.length === 0) {
        errorHandler('noBoardsInDashboard');
        return;
    }

    // Visar "Sort" knappen endast om det är fler än 1 board
    if (boards.length > 1) {
        sortBtn.style.display = "block";
    }

    const sortedBoards = sortBoards(boards, sortBy, selectedTag);
    displayBoards(sortedBoards, loggedInUser);
}

// Funktion för att sortera enligt givna parametrar
function sortBoards(boards, sortBy, selectedTag) {
    let sortedBoards = selectedTag ? boards.filter(board => board.tag === selectedTag) : boards;

    if (selectedTag) {
        const otherBoards = boards.filter(board => board.tag !== selectedTag);
        sortedBoards = [...sortedBoards, ...otherBoards];
    }

    if (sortBy === 'alphabetical') {
        sortedBoards.sort((a, b) => a.name.localeCompare(b.name));
    }

    return sortedBoards;
}

// Funktion för att visa boardsen
function displayBoards(sortedBoards, loggedInUser) {
    const uniqueTags = [];
    const fragment = document.createDocumentFragment(); // Fragment för att uppdatera DOM i ett

    sortedBoards.forEach(board => { // createBoardListItem tar emot board, function 1, function 2
        const listItem = createBoardListItem(
            board,
            async (boardId) => {
                await removeBoard(boardId);
            },
            async (boardId) => {
                await loadDashboard(board, loggedInUser);
            },
            loggedInUser
        );

        if (board.tag) { // Om denna board har en tag, ge den id=list-tag
            listItem.id = 'list-tag';
        }

        fragment.appendChild(listItem); // Lägger till varje board till fragmentet

        if (board.tag && !uniqueTags.includes(board.tag)) {
            uniqueTags.push(board.tag);
        }
    });

    dashboardList.innerHTML = ''; // Tömmer innehållet i dashboard
    dashboardList.appendChild(fragment); // Lägger till alla boards till dashboard

    // Hämtar unika tags i boards
    sortTags.innerHTML = ''; 
    uniqueTags.forEach(tag => {
        const option = createElement('option', '', tag);
        sortTags.appendChild(option);
    });

    const currentSelectedBoardId = getGlobalId(); // Hämtar vald board
    selectListItem(currentSelectedBoardId); // Kör selectListITem för att ge vald board specifikt utseende
}

// Funktion för att ta bort en board
async function removeBoard(boardId) {
    const confirmed = await verifyDelete('board'); // Kör verifyDelete, returnerar true/false
    let globalBoardId = getGlobalId();

    if (confirmed) {
        try {
            const response = await apiFetch(`http://localhost:3000/boards/${boardId}`, 'DELETE', null)

            if (response.success) {
                if (boardId == globalBoardId) { // Om vi raderar den board som vi är på
                    selectedListItemId = null;
                    hideMsg(stickyNotesContainer);
                    dashboard.classList.remove('move-left');
                }

                document.getElementById('custom-popup').remove(); // Raderar popup
                await getBoards(); // Fetchar den nya listan med boards pånytt
                hideMsg(confirmationBox);
                if (!isWebSocketFail()) sendWebSocketMessage(boardId, 'deleteBoard'); // Skickar websocket meddelande endast om websocket fungerar
            } else {
                errorHandler('unauthorizedDeletion');
            }
        } catch (error) {
            console.error("Failed to remove board:", error);
        }
    }
};

// Funktion för att skapa en ny board
export async function createNewBoard(showingDashboard) {
    const dashTag = document.getElementById('dash-tag').value;
    const dashName = document.getElementById('dash-name').value;
    const isPrivate = privateCheckbox.checked;
    const password = document.getElementById('board-password').value;

    if (!dashName.trim()) { // Om namnet på dashboarden är en tom sträng
        errorMessage.textContent = "Dashboard must have a name."
        showError(errorMessage);
        return;
    }

    if (isPrivate && !password.trim()) { // Om boarden är markerad som privat, ange ett lösenord
        errorMessage.textContent = "Please provide a password for the board!";
        showError(errorMessage);
        return;
    }

    try { // Skapar en board med angedda parametrar
        const response = await apiFetch(`http://localhost:3000/create-board`, 'POST', { dashName, dashTag, isPrivate, password: isPrivate ? password : null })

        if (isPrivate) { // Om boarden är privat, spara en boardToken för access
            const boardToken = response.boardToken;
            localStorage.setItem(`board_${response.board.id}_access`, boardToken);
            const boardRefreshToken = response.boardRefreshToken;
            localStorage.setItem(`board_${response.board.id}_refresh_access`, boardRefreshToken)
        }

        if (showingDashboard) { // Om vi redan har klickat på en board
            selectedListItemId = response.board.id;
            hideMsg(createNewDash);
            showMsg(stickyNotesContainer);
            dashboard.style.display = 'flex';
            dashboard.classList.add('move-left');
            await loadDashboard(selectedListItemId);
        } else {
            hideMsg(createNewDash);
            dashboard.style.display = 'flex';
            dashboard.classList.remove('move-left');
            showMsg(dashboard);
        }

        if (!isWebSocketFail()) sendWebSocketMessage(null, 'createBoard', null);
        await getBoards();
    } catch (error) {
        console.error("Failed to create board. ", error);
        errorHandler('apiFetchFail');
    }
}

document.getElementById('apply-sort-btn').addEventListener('click', async () => { // 'Apply Sort' knappen
    const selectedTag = document.getElementById('sort-tags').value; // Vilken tag vi har valt att sortera enligt
    const sortOption = document.querySelector('input[name="sortOption"]:checked'); // Den som är i checkad, tag eller alphabetical

    // Skickas till getBoards för att sortera enligt valt filter
    if (sortOption.value === 'tag') {
        sortBy = 'tag';
    } else {
        sortBy = 'alphabetical'
    }
    await getBoards(sortBy, selectedTag);
    hideMsg(document.getElementById('sort-popup'));
    showMsg(newNoteBtn);
});
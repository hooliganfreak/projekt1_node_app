const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
require('dotenv').config();

const app = express();
const path = require('path');
const prisma = new PrismaClient();
app.use(express.json());
app.use(cors());

// Error hjälp från ChatGPT
// Serve static files from the 'node_app' directory
app.use(express.static(path.join(__dirname)));

// Root route to serve index.html
app.get('/', (res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint för att checka JWT token
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    // Verifierar jwt token
    jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') { // Returnerar 222 om token är expired
                return res.status(222).json({ message: "Token has expired. " });
            } else {
                return res.status(403).json({ message: "Invalid token. " });
            }
        }

        req.user = user;
        next();
    })
}

// Endpoint för att checka JWT refreshtoken
const authenticateRefreshJWT = (req, res, next) => {
    const authHeader = req.headers['authorization']
    const refreshToken = authHeader && authHeader.split(' ')[1];

    if (refreshToken == null) return res.sendStatus(401);

    jwt.verify(refreshToken, process.env.REFRESH_SECRET_KEY, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') { // Returnerar 222 om token är expired
                return res.status(222).json({ message: "Token has expired. " });
            } else {
                return res.status(403).json({ message: "Invalid token. " });
            }
        }

        req.user = user;
        next();
    })
}

// Endpoint för att checka JWT board token
const authenticateBoardJWT = (req, res, next) => {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);
    // Verifierar jwt token
    jwt.verify(token, process.env.BOARD_SECRET_KEY, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') { // Returnerar 222 om token är expired
                return res.status(222).json({ message: "Token has expired. " });
            } else {
                return res.status(403).json({ message: "Invalid token. " });
            }
        }

        req.user = user;
        next();
    })
}

// Endpoint för att checka JWT board refreshtoken
const authenticateBoardRefreshJWT = (req, res, next) => {
    const authHeader = req.headers['authorization']
    const refreshToken = authHeader && authHeader.split(' ')[1];
    if (refreshToken == null) return res.sendStatus(401);

    jwt.verify(refreshToken, process.env.BOARD_REFRESH_SECRET_KEY, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') { // Returnerar 222 om token är expired
                return res.status(222).json({ message: "Token has expired. " });
            } else {
                return res.status(403).json({ message: "Invalid token. " });
            }
        }

        req.user = user;
        next();
    })
}

app.post('/validate-token', authenticateJWT, (req, res) => {
    res.json({ valid: true });
});

app.post('/refresh-token', authenticateRefreshJWT, async (req, res) => {
    const user = req.user;
    // Generate a new access token
    const newAccessToken = jwt.sign(
        { userId: user.userId, username: user.username },
        process.env.SECRET_KEY, 
        { expiresIn: '1h' } 
    );

    res.json({ success: true, accessToken: newAccessToken });
})

app.post('/refresh-board-token', authenticateBoardRefreshJWT, async (req, res) => {
    const user = req.user;

    // Generate a new access token
    const newAccessToken = jwt.sign(
        { userId: user.userId, username: user.username },
        process.env.BOARD_SECRET_KEY, 
        { expiresIn: '1h' } 
    );

    res.json({ success: true, accessToken: newAccessToken });
})

// Endpoint för att registrera en användare
app.post('/register', async (req, res) => {
    // username och password finns i request body
    const { username, password } = req.body;

    // Error handling
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    if (username.length < 4 || username.length > 20) {
        return res.status(400).json({ error: 'Username must be between 4 and 20 characters' });
    }
    if (password.length < 6 || password.length > 20) {
        return res.status(400).json({ error: 'Password must be between 6 and 20 characters' });
    }

    try {
        const userExists = await prisma.user.findUnique({
            where: { username },
        });
        if (userExists) {
            return res.status(400).json({ error: 'That username already exists.' });
        }
        // Hasha lösenordet
        const hashedPassword = await bcrypt.hash(password, 10);

        // Skapar den nya användaren
        await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
            },
        });

        res.status(201).json({ message: 'User created successfully!' });
        // Om try misslyckas så ger vi ett error    
    } catch (error) {
        res.status(500).json({ error: 'Something went wront creating the user.' });
    }
});

// Endpoint för att logga in 
app.post('/login', async (req, res) => {
    // username och password finns i request body
    const { username, password } = req.body;

    // Error handling 
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        // Vi hittar användaren med dess unika användarnamn
        const user = await prisma.user.findUnique({
            where: { username },
        })

        // Checkar om användaren finns före vi validerar lösenordet
        if (!user) return res.status(401).json({ error: 'User does not exist.' });

        // Checkar om lösenordet är rätt
        const isPasswordValid = await bcrypt.compare(password, user.password);

        // Om fel lösenord
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Vi hittar Board.id som hör till användaren
        const boards = await prisma.board.findMany({
            where: { userId: user.id }
        });

        const boardIds = [];
        for (let i = 0; i < boards.length; i++) {
            boardIds.push(boards[i].id);
        }

        // Om både username och password är rätt så skapar vi en JWT token
        const token = jwt.sign(
            {
                userId: user.id,
                username: user.username,
                boards: boardIds
            },
            process.env.SECRET_KEY,
            { expiresIn: '1h' }
        )

        // Skapa refresh token 
        const refreshToken = jwt.sign(
            { userId: user.id },
            process.env.REFRESH_SECRET_KEY,
            { expiresIn: '7d' }
        );

        // Vi skickar tillbaks token, refreshToken och username
        res.status(200).json({
            token,
            refreshToken,
            username: user.username
        })

        // Om try misslyckas så ger vi ett error    
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Endpoint för att skapa en ny board
app.post('/create-board', authenticateJWT, async (req, res) => {
    const { dashName, dashTag, isPrivate, password } = req.body;
    const hashedPassword = isPrivate ? await bcrypt.hash(password, 10) : null;

    try {
        const newBoard = await prisma.board.create({
            data: {
                name: dashName,
                tag: dashTag,
                isPrivate,
                password: hashedPassword,
                userId: req.user.userId
            }
        });

        let boardToken;
        if (isPrivate) { // Skapar en boardToken 
            boardToken = jwt.sign(
                {boardId: newBoard.id, userId: req.user.userId },
                process.env.BOARD_SECRET_KEY,
                {expiresIn: '1h'}
            );
        }

        if (isPrivate) { // Skapar en boardRefreshToken
            boardRefreshToken = jwt.sign(
                {boardId: newBoard.id, userId: req.user.userId },
                process.env.BOARD_REFRESH_SECRET_KEY,
                {expiresIn: '7d'}
            );
        }

        res.status(201).json({ 
            message: 'Dashboard created successfully', 
            board: newBoard,
            boardToken: isPrivate ? boardToken : null,
            boardRefreshToken: isPrivate ? boardRefreshToken : null
         });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error." });
    }
});

app.post('/get-board-details', async (req, res) => {
    const { boardId, isPrivate, isBoardCreator } = req.body;
    try {
        if (isPrivate && !isBoardCreator) {
            return authenticateBoardJWT(req, res, async () => {
                const boardDetails = await prisma.board.findFirst({
                    where: { id: boardId },
                    include: {
                        stickyNotes: true,
                    }
                })
                res.status(201).json({ message: `Board ${boardId} details`, boardDetails: boardDetails, loggedInUser: req.user });
            })
        } else {
            return authenticateJWT(req, res, async () => {
                const boardDetails = await prisma.board.findFirst({
                    where: { id: boardId },
                    include: {
                        stickyNotes: true,
                    }
                })
                res.status(201).json({ message: `Board ${boardId} details`, boardDetails: boardDetails, loggedInUser: req.user });
            })
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error." });
    }
})

app.post('/verify-board-password', authenticateJWT, async (req, res) => {
    const { boardId, password } = req.body;

    try {
        const board = await prisma.board.findUnique({
            where: { id: boardId },
            select: { password: true, isPrivate: true } // Checka om board är private och hämta lösenordet
        })

        const isPasswordValid = await bcrypt.compare(password, board.password);
        if (isPasswordValid) {
            boardToken = jwt.sign(
                {boardId: board.id, userId: req.user.userId },
                process.env.BOARD_SECRET_KEY,
                {expiresIn: '1h'}
            );
            const boardRefreshToken = jwt.sign(
                {boardId: board.id, userId: req.user.userId },
                process.env.BOARD_REFRESH_SECRET_KEY,
                {expiresIn: '7d'}
            )
            return res.status(200).json({ success: true, boardToken: boardToken, boardRefreshToken: boardRefreshToken }); // Rätt löseonord
        } else {
            return res.status(200).json({ success: false }); // Fel lösenord
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
})

// Endpoint för att skapa en ny sticky note
app.post('/create-sticky-note', authenticateJWT, async (req, res) => {
    const { noteName, noteColor, boardId } = req.body;

    try {
        const newStickyNote = await prisma.stickyNote.create({
            data: {
                noteName: noteName,
                noteColor: noteColor,
                positionX: 0,
                positionY: 0,
                updatedAt: new Date(),
                user: {
                    connect: { id: req.user.userId }
                },
                board: {
                    connect: { id: boardId }
                }
            }
        });

        res.status(201).json({ message: "Sticky note created successfully!", stickyNote: newStickyNote });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error." });
    }
})

// Endpoint för att få sticky notes 
app.get('/notes/:id', authenticateJWT, async (req, res) => {
    const { id } = req.params;
    const boardId = parseInt(id);

    try {
        const stickyNotes = await prisma.stickyNote.findMany({
            where: { boardId: boardId },
            include: {
                user: {
                    select: {
                        username: true,
                    }
                }
            }
        })
        res.status(200).json(stickyNotes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint för att uppdatera sticky-notes position
app.patch('/notes_position/:id', authenticateJWT, async (req, res) => {
    const { id } = req.params;
    const { newPositionX, newPositionY } = req.body;

    try {
        const updatedNote = await prisma.stickyNote.update({
            where: { id: parseInt(id) },
            data: {
                positionX: parseFloat(newPositionX),
                positionY: parseFloat(newPositionY),
            },
        });
        res.status(200).json(updatedNote);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint för att uppdatera sticky-notes content
app.patch('/notes_content/:id', authenticateJWT, async (req, res) => {
    const { id } = req.params;
    const { newText, newName } = req.body;

    try {
        const updatedNote = await prisma.stickyNote.update({
            where: { id: parseInt(id) },
            data: {
                noteText: newText,
                noteName: newName
            },
        });
        res.status(200).json(updatedNote);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint för att uppdatera sticky-notes dimensioner
app.patch('/notes_dimensions/:id', authenticateJWT, async (req, res) => {
    const { id } = req.params;
    const { newWidth, newHeight } = req.body;

    try {
        const updatedNote = await prisma.stickyNote.update({
            where: { id: parseInt(id) },
            data: {
                width: parseInt(newWidth),
                height: parseInt(newHeight)
            },
        });
        res.status(200).json(updatedNote);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint för att radera en sticky-note
app.delete('/notes_delete/:id', authenticateJWT, async (req, res) => {
    const { id } = req.params;

    try {
        const noteToDelete = await prisma.stickyNote.findUnique({
            where: { id: Number(id) }
        });

        if (!noteToDelete) {
            return res.status(404).json({ error: "Note not found" });
        }

        await prisma.stickyNote.delete({
            where: { id: Number(id) }
        });

        res.status(200).json({ success: true, message: 'Note removed successfully' });
    } catch (error) {
        console.error('Error removing note:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})


// Endpoint för att få boards
app.get('/boards', authenticateJWT, async (req, res) => {
    try { // Detta hämtar alla boards samt vem som skapat den, så att alla inloggade användare kan se alla andras boards
        const boards = await prisma.board.findMany({
            include: {
                user: {
                    select: {
                        username: true,
                        id: true,
                    }
                },
                stickyNotes: true,
            }
        });

        res.json({ boards , loggedInUser: { userId: req.user.userId } });
    } catch (error) {
        console.error('Error fetching boards:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.delete('/boards/:id', authenticateJWT, async (req, res) => {
    const { id } = req.params;

    try {
        const boardToDelete = await prisma.board.findUnique({
            where: { id: Number(id) },
            select: { userId: true }
        });

        if (!boardToDelete) {
            return res.status(404).json({ error: "Board not found" });
        }

        // Check if the current user is the creator of the board
        if (boardToDelete.userId !== req.user.userId) {
            return res.status(403).json({ error: "Only the creator can delete this board." });
        }

        await prisma.board.delete({
            where: { id: Number(id) }
        });

        res.status(200).json({ success: true, message: 'Board removed successfully' });
    } catch (error) {
        console.error('Error removing board:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
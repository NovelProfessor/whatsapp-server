const express = require("express")
const fileUpload = require("express-fileupload");

const messageRouter = require('./messageRouter.js')
const fs = require("fs");
const { initializeDatabase } = require('./connect.js')

const app = express()

app.use(fileUpload());
app.use(express.static("public"))
app.use(express.json())
app.use(messageRouter)

// create media folder if it doesn't exist
const mediaPath = `${__dirname}/media`;

try {

    if (!fs.existsSync(mediaPath)) {
        fs.mkdirSync(mediaPath);
        console.log(`Folder '${mediaPath}' created successfully.`);
    } else {
        console.log(`Folder '${mediaPath}' already exists.`);
    }

} catch (err) {
    console.log('Error creating media folder:', err);
    process.exit(1);
}

// Initialize database and start server
initializeDatabase().then(() => {
    app.listen(process.env.PORT || 80, () => console.log(`Server is ready on port ${process.env.PORT || 80}`))
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
})

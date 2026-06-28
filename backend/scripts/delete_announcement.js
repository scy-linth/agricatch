const { pool } = require('../utils/db');

async function deleteAnnouncement(id) {
    try {
        await pool.query('DELETE FROM announcements WHERE id = $1', [id]);
        console.log(`Deleted announcement ID ${id}`);
        await pool.end();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

const id = process.argv[2] || 14;
deleteAnnouncement(id);

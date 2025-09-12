// // Add a test endpoint to check authentication

// router.get('/check-admin', isAuthenticated, (req, res) => {
//   const user = req.user;
//   const timestamp = new Date().toISOString();
  
//   console.log(`[${timestamp}] Admin check requested for: ${user.uid}`);
  
//   // Development admin whitelist
//   const adminWhitelist = ['dharmendra23101', 'af9GjxDZDeNCT69gLbEkk45md1x1', 'aJJJxZNJXsZgQStO3yL7ahjKZDr1'];
  
//   if (process.env.NODE_ENV === 'development' && adminWhitelist.includes(user.uid)) {
//     console.log(`[${timestamp}] Development mode: User ${user.uid} has admin access`);
//     return res.json({ 
//       isAdmin: true, 
//       message: 'User has admin privileges (Development mode)',
//       user: user.uid,
//       timestamp
//     });
//   }
  
//   // For production, check database
//   pool.query('SELECT is_admin FROM users WHERE firebase_uid = $1', [user.uid])
//     .then(result => {
//       const isAdmin = result.rows.length > 0 && result.rows[0].is_admin;
      
//       console.log(`[${timestamp}] Admin check for ${user.uid}: ${isAdmin ? 'Is admin' : 'Not admin'}`);
      
//       res.json({
//         isAdmin: isAdmin,
//         message: isAdmin ? 'User has admin privileges' : 'User does not have admin privileges',
//         user: user.uid,
//         timestamp
//       });
//     })
//     .catch(err => {
//       console.error(`[${timestamp}] Admin check error:`, err);
//       res.status(500).json({ message: 'Error checking admin status' });
//     });
// });
const {
  forwardAuthenticated
} = require('../config/auth');
const passport = require('passport');
const express = require('express');
const bcrypt = require('bcryptjs');

const router = express.Router();

const User = require('../models/User');

router.get('/login', forwardAuthenticated, (req, res) => res.render('login'));

// router.get('/register', forwardAuthenticated, (req, res) => res.render('register'));

router.post('/register', (req, res) => {
  const {
    name,
    email,
    password,
    password2
  } = req.body;
  let errors = [];

  if (!name || !email || !password || !password2) {
    errors.push({
      msg: 'Veullez compléter tous les champs'
    });
  }

  if (password != password2) {
    errors.push({
      msg: 'Les mot de passe ne correspondent pas'
    });
  }

  if (password.length < 6) {
    errors.push({
      msg: 'Le mot de passe doit faire au moins 6 caractères'
    });
  }

  if (errors.length > 0) {
    res.render('register', {
      errors,
      name,
      email,
      password,
      password2
    });
  } else {
    User.findOne({
      name: name
    }).then(user => {
      if (user) {
        errors.push({
          msg: 'Cet identifiant est déja associé à un compte'
        });
        res.render('register', {
          errors,
          name,
          email,
          password,
          password2
        });
      } else {
        const newUser = new User({
          name,
          email,
          password
        });

        bcrypt.genSalt(10, (err, salt) => {
          bcrypt.hash(newUser.password, salt, (err, hash) => {
            if (err) throw err;
            newUser.password = hash;
            newUser
              .save()
              .then(user => {
                req.flash(
                  'success_msg',
                  'Votre compte à été créé, vous pouvez maintenant vous connecter'
                );
                res.redirect('/users/login');
              })
              .catch(err => console.log(err));
          });
        });
      }
    });
  }
});

router.post('/login', (req, res, next) => {
  passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/users/login',
    failureFlash: true
  })(req, res, next);
});

// Logout
router.get('/logout', (req, res) => {
  req.logout();
  req.flash('success_msg', 'Vous êtes déconnecté');
  res.redirect('/users/login');
});

module.exports = router;

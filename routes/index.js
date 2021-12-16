const {
  ensureAuthenticated,
  forwardAuthenticated
} = require('../config/auth');
const express = require('express');
const bcrypt = require('bcryptjs');
const https = require('https');
const path = require('path');

const User = require('../models/User');
const Habitant = require('../models/Habitant');

const router = express.Router();

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

router.get('/', forwardAuthenticated, (req, res) => res.render('login'));

router.get("/dashboard", ensureAuthenticated, (req, res) => {
  var total, seenCitizens, declinedCitizens, acceptedCitizens, totalCitizens,
    total = seenCitizens = declinedCitizens = acceptedCitizens = totalCitizens = 0;
  User.find(function(err, users) {
    Habitant.find(function(err, habitants) {
      for (var i = 0; i < users.length; i++)
        total += users[i].money
      for (var i = 0; i < habitants.length; i++) {
        totalCitizens++
        if (habitants[i].given != 'notSeen')
          seenCitizens++
        if (habitants[i].given == 'declined')
          declinedCitizens++
        if (habitants[i].given != 'notSeen' && habitants[i].given != 'declined')
          acceptedCitizens++
      }
      res.render('dashboard', {
        user: req.user,
        total: total,
        seenCitizens: seenCitizens,
        declinedCitizens: declinedCitizens,
        acceptedCitizens: acceptedCitizens,
        totalCitizens: totalCitizens
      });
    });
  });
});

router.get("/map", ensureAuthenticated, (req, res) => {
  Habitant.find(function(err, habitants) {
    res.render('map', {
      user: req.user,
      habitants: habitants
    });
  });
});

router.get("/tour", ensureAuthenticated, (req, res) => {
  Habitant.find(function(err, habitants) {
    res.render('tour', {
      user: req.user,
      habitants: habitants
    });
  });
});

router.get("/habitants", ensureAuthenticated, (req, res) => {
  Habitant.find(function(err, habitants) {
    res.render('habitants', {
      user: req.user,
      habitants: habitants
    });
  });
});

router.get("/habitants/:search", ensureAuthenticated, (req, res) => {
  Habitant.find({
    $or: [{
        "name": {
          $regex: new RegExp(req.params.search, 'i')
        }
      },
      {
        "lastName": {
          $regex: new RegExp(req.params.search, 'i')
        }
      },
      {
        "address": {
          $regex: new RegExp(req.params.search, 'i')
        }
      }
    ]
  }, function(err, habitants) {
    res.render('habitants', {
      user: req.user,
      habitants: habitants
    });
  });
});

router.get("/habitant/:id", ensureAuthenticated, (req, res) => {
  Habitant.findOne({
    _id: req.params.id
  }, function(err, habitant) {
    res.render('habitant', {
      user: req.user,
      habitant: habitant
    });
  })
});

router.get("/addHabitant", ensureAuthenticated, (req, res) => {
  res.render('addHabitant');
});

router.post("/addHabitant", ensureAuthenticated, async (req, res) => {
  if (req.body.autoloc == 'on') {
    if (req.body.latitude === '' && req.body.longitude === '') {
      req.flash('error_msg', 'La position n\'a pas été reconnue');
      res.redirect('/addHabitant');
    } else {
      var url = 'https://maps.googleapis.com/maps/api/geocode/json?latlng=' + req.body.latitude + ',' + req.body.longitude + '&key=AIzaSyBFIad86hvh5HRUGYn-Wctw7HVSBsYH6Ok'
      https.get(url, (resp) => {
        let data = ''
        resp.on('data', (chunk) => {
          data += chunk;
        });
        resp.on('end', () => {
          data = JSON.parse(data).results[0];
          var name
          if (req.body.name)
            name = req.body.name;
          else
            name = ''
          var newHabitant = new Habitant({
            name: name,
            address: data.formatted_address,
            cp: ' ',
            city: ' ',
            addBy: req.user.name,
            geolocation: {
              lat: req.body.latitude,
              lng: req.body.longitude
            }
          });
          newHabitant.save(function(err) {
            if (err) return console.log(err);
            res.redirect('/customMarker/' + newHabitant._id);
          });
        });
      }).on("error", (err) => {
        console.log("Error: " + err.message);
      });
    }
  } else {
    var cpcity = req.body.cpcity.split(" ");
    var cp = cpcity[0];
    var city = cpcity[1];
    var address = req.body.address + '+' + cp + '+' + city;
    address.split(' ').join('+');
    var url = 'https://maps.googleapis.com/maps/api/geocode/json?address=' + address + '&key=AIzaSyBFIad86hvh5HRUGYn-Wctw7HVSBsYH6Ok'
    https.get(url, (resp) => {
      let data = ''
      resp.on('data', (chunk) => {
        data += chunk;
      });
      resp.on('end', () => {
        data = JSON.parse(data).results[0];
        Habitant.findOne({
          geolocation: {
            lat: data.geometry.location.lat,
            lng: data.geometry.location.lng
          }
        }, function(err, habitant) {
          var name
          if (req.body.name)
            name = req.body.name;
          else
            name = ''
          var newHabitant = new Habitant({
            name: name,
            address: req.body.address,
            cp: cp,
            city: city,
            addBy: req.user.name,
            geolocation: {
              lat: data.geometry.location.lat,
              lng: data.geometry.location.lng
            }
          });
          if (habitant) {
            newHabitant.geolocation.lat = data.geometry.location.lat + (Math.random() - .5) / 10000;
            newHabitant.geolocation.lng = data.geometry.location.lng + (Math.random() - .5) / 10000;
          }
          newHabitant.save(function(err) {
            if (err) return console.log(err);
            // res.redirect('/habitants');
            res.redirect('/customMarker/' + newHabitant._id);
          });
        });
      });
    }).on("error", (err) => {
      console.log("Error: " + err.message);
    });
  }
});

router.get("/customMarker/:id", ensureAuthenticated, (req, res) => {
  Habitant.find({}, function(err, habitants) {
    var index = habitants.findIndex(e => e._id == req.params.id);
    var habitant = habitants[index];
    habitants.splice(index, 1);
    res.render('customMarker', {
      user: req.user,
      habitants: habitants,
      habitant: habitant
    });
  })
});

router.post("/customMarker", ensureAuthenticated, (req, res) => {
  Habitant.findOneAndUpdate({
    _id: req.body.id
  }, {
    geolocation: {
      lat: req.body.lat,
      lng: req.body.lng
    }
  }, {
    new: true
  }, function(err, response) {
    if (err) {
      console.log(err);
    } else {
      console.log(response);
      res.redirect('/habitant/' + req.body.id);
    }
  })
});

router.get("/updateHabitant/:id", ensureAuthenticated, (req, res) => {
  Habitant.findOne({
    _id: req.params.id
  }, function(err, habitant) {
    res.render('updateHabitant', {
      user: req.user,
      habitant: habitant
    });
  })
});

router.post("/updateHabitant", ensureAuthenticated, async (req, res) => {
  var address;
  if (req.body.cp === '' || req.body.city === '') {
    address = req.body.address.split(' ').join('+').split(',').join('+');
  } else {
    var address = req.body.address + '+' + req.body.cp + '+' + req.body.city;
    address.split(' ').join('+');
  }
  var url = 'https://maps.googleapis.com/maps/api/geocode/json?address=' + address + '&key=AIzaSyBFIad86hvh5HRUGYn-Wctw7HVSBsYH6Ok'
  https.get(url, (resp) => {
    let data = '';

    resp.on('data', (chunk) => {
      data += chunk;
    });

    resp.on('end', () => {
      data = JSON.parse(data).results[0];
      Habitant.findOne({
        geolocation: {
          lat: data.geometry.location.lat,
          lng: data.geometry.location.lng
        }
      }, function(err, habitant) {
        var name
        if (req.body.name)
          name = req.body.name;
        else
          name = ''
        if (habitant) {
          Habitant.findOneAndUpdate({
            _id: req.body.id
          }, {
            name: name,
            address: req.body.address,
            cp: req.body.cp,
            city: req.body.city,
            geolocation: {
              lat: data.geometry.location.lat + (Math.random() - .5) / 10000,
              lng: data.geometry.location.lng + (Math.random() - .5) / 10000
            }
          }, {
            new: true
          }, function(err, response) {
            if (err) {
              console.log(err);
            } else {
              console.log(response);
              res.redirect('/habitant/' + req.body.id);
            }
          })
        } else {
          var name
          if (req.body.name)
            name = req.body.name;
          else
            name = ''
          Habitant.findOneAndUpdate({
            _id: req.body.id
          }, {
            name: name,
            address: req.body.address,
            cp: req.body.cp,
            city: req.body.city,
            geolocation: {
              lat: data.geometry.location.lat,
              lng: data.geometry.location.lng
            }
          }, {
            new: true
          }, function(err, response) {
            if (err) {
              console.log(err);
            } else {
              console.log(response);
              res.redirect('/habitant/' + req.body.id);
            }
          })
        }
      });
    });

  }).on("error", (err) => {
    console.log("Error: " + err.message);
  });
});

router.get("/deleteHabitant/:id", ensureAuthenticated, (req, res) => {
  Habitant.deleteOne({
    _id: req.params.id
  }, function(err) {
    if (err) return handleError(err);
    res.redirect('/habitants');
  });
});

router.get("/absent/:id", ensureAuthenticated, (req, res) => {
  Habitant.findOneAndUpdate({
    _id: req.params.id
  }, {
    $inc: {
      visits: 1
    }
  }, {
    new: true
  }, function(err, response) {
    if (err) {
      console.log(err);
    } else {
      res.redirect('/habitant/' + req.params.id);
    }
  })
});

router.get("/declined/:id", ensureAuthenticated, (req, res) => {
  Habitant.findOneAndUpdate({
    _id: req.params.id
  }, {
    $set: {
      given: "declined"
    }
  }, {
    new: true
  }, function(err, response) {
    if (err) {
      console.log(err);
    } else {
      res.redirect('/habitant/' + req.params.id);
    }
  })
});

router.post("/accepted/:id", ensureAuthenticated, (req, res) => {
  if (req.body.given < 0) {
    req.flash(
      'error_msg',
      'Vous avez entré un nombre négatif'
    );
    res.redirect('/habitant/' + req.params.id);
  } else {
    var given = req.body.given.toString();
    Habitant.findOneAndUpdate({
      _id: req.params.id
    }, {
      $set: {
        given: given
      }
    }, {
      new: true
    }, function(err, response) {
      if (err)
        throw err
      else {
        User.findOneAndUpdate({
          _id: req.user._id
        }, {
          $inc: {
            money: given
          }
        }, {
          new: true
        }, function(err, response) {
          if (err)
            throw err
          else
            res.redirect('/habitant/' + req.params.id);
        })
      }
    })
  }
});

router.get("/addUser", ensureAuthenticated, (req, res) => {
  if (req.user.isAdmin == true) {
    res.render('addUser');
  } else {
    res.redirect('/')
  }
});

router.post("/addUser", ensureAuthenticated, (req, res) => {
  if (req.user.isAdmin == true) {
    var newUser = new User({
      name: req.body.name,
      password: req.body.password
      // ekip: req.body.ekip
    });
    bcrypt.genSalt(10, (err, salt) => {
      bcrypt.hash(newUser.password, salt, (err, hash) => {
        if (err) throw err;
        newUser.password = hash;
        newUser
          .save()
          .then(user => {
            newUser.save(function(err) {
              if (err) return console.log(err);
              req.flash(
                'success_msg',
                'L\'utilisateur a été ajouté'
              );
              res.redirect('/dashboard');
            });
          })
          .catch(err => console.log(err));
      });
    });
  } else {
    res.redirect('/')
  }
});

router.get("/updatePassword", ensureAuthenticated, (req, res) => {
  res.render('updatePasswordPage');
});

router.post("/updatePassword", ensureAuthenticated, (req, res) => {
  bcrypt.compare(req.body.exPassword, req.user.password, (err, isMatch) => {
    if (err) throw err;
    if (isMatch) {
      if (req.body.newPassword == req.body.newPasswordConfirm) {
        bcrypt.genSalt(10, (err, salt) => {
          bcrypt.hash(req.body.newPassword, salt, (err, hash) => {
            if (err) throw err;
            User.findOneAndUpdate({
              _id: req.user._id
            }, {
              password: hash
            }, {
              new: true
            }, function(err, response) {
              if (err) {
                console.log(err);
              } else {
                req.flash(
                  'success_msg',
                  'Le mot de passe a été modifié'
                );
                res.redirect('/dashboard');
              }
            })
          });
        });
      } else {
        req.flash(
          'error_msg',
          'Les mot de passe ne correspondent pas'
        );
        res.redirect('/updatePassword');
      }
    } else {
      req.flash(
        'error_msg',
        'Mot de passe incorrect'
      );
      res.redirect('/updatePassword');
    }
  });
});

module.exports = router;

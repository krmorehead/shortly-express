var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');
var session = require('express-session');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(session({secret: 'danandkyle'}))
app.use(passport.initialize());
app.use(passport.session());
/*
app.configure(function() {
  app.use(express.static('public'));
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.session({ secret: 'keyboard cat' }));
  app.use(app.router);
});
*/
var sess;

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  new User({username : user}).fetch().then(function(user){
    if(user){
      done(null, user);
    }else{
      done(null, false, {message:'user does not exist'})
    }
  });
});

passport.use("login", new LocalStrategy(
  {
    passReqToCallback: true
  },

  function(req, username, password, done){
  var username = req.body.username;
  var password = req.body.password;
  new User({username: username}).fetch().then(function(user){
    if(user){
      var hashPass = user.get('password');
      bcrypt.compare(req.body.password, hashPass, function(err, response){
        if(response){
          done(null, user.attributes.username);
        }else{
          done(err);
        }
      });
    }else{
      done(null, false, {message: 'user does not exist'});
    }
  });
}));

app.get('/', 
function(req, res) {
  // sess = req.session
  // if(sess.username){
  if(req.isAuthenticated()){
    res.render('index');    
  }else{
    res.redirect("/login")
  }
});

app.get('/login', 
function(req, res){
  res.render("login")
});

app.get('/logout',
function(req, res){
  req.logout();
  res.redirect('/login');
})

app.get('/create',
function(req, res){ 
  if(req.isAuthenticated()){
    res.render('index');    
  }else{
    res.redirect("/login")
  }
});

app.get('/links', 
function(req, res) {
  if(req.isAuthenticated()){
    Links.reset().fetch().then(function(links) {
      res.send(200, links.models);
    });
  }else{
    res.redirect("/login")
  }
});

app.get('/signup', 
function(req, res){
  res.render('signup')
});

app.post("/signup", 
function(req, res){
  new User(req.body.username, req.body.password);
  util.passwordHash(req.body.password, function(err, pass){
    Users.create({
      username: req.body.username,
      password: pass
    }).then(function(something){
      req.session.username = req.body.username;
      res.redirect('/');
    });
  });
});


// app.post('/login',
//   passport.authenticate('local'),
//   function(req, res) {
//     // If this function gets called, authentication was successful.
//     // `req.user` contains the authenticated user.
//     res.redirect('/users/' + req.user.username);
//   });
app.post('/login', 
  passport.authenticate("login", {successRedirect : "/", failureRedirect : '/login'})
  // new User({username: req.body.username}).fetch().then(function(user){
  //   if(user){
  //     var hashPass = user.get('password');
  //     bcrypt.compare(req.body.password, hashPass, function(err, response){
  //       if(!err){
  //         req.session.username = req.body.username;
  //         res.redirect("/");
  //       }else{
  //         res.redirect("/login");
  //       }
  //     });
  //   }
  //   else{
  //     res.redirect("/login");
  //   }
  // });
);

// bcrypt.compare("bacon", hash, function(err, res) {
//     // res == true
// });

app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        Links.create({
          url: uri,
          title: title,
          base_url: req.headers.origin
        })
        .then(function(newLink) {
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits')+1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);

// app.post('/login', passport.authenticate('local', { successRedirect: '/',
//                                                     failureRedirect: '/login' }));
// passport.serializeUser(function(user, done) {
//   done(null, user.id);
// });

// passport.deserializeUser(function(id, done) {
//   User.findById(id, function(err, user) {
//     done(err, user);
//   });
// });

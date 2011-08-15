/** URL of most recent script. Currently the master branch of my GitHub. */
var REMOTE_SCRIPT_URL = "https://raw.github.com/sarenji/poserver/master/scripts.js"
/** URL of most recent tiers.xml. Currently the master branch of my GitHub. */
var REMOTE_TIERS_URL  = "https://raw.github.com/sarenji/poserver/master/tiers.xml"

/** User authentication constants */
var USER          = 0;
var MODERATOR     = 1;
var ADMINISTRATOR = 2;
var OWNER         = 3;

var AUTH_VALUES = {
  OWNER         : OWNER,
  ADMIN         : ADMINISTRATOR,
  ADMINISTRATOR : ADMINISTRATOR,
  MOD           : MODERATOR,
  MODERATOR     : MODERATOR,
  USER          : USER
};

/** Other constants */
var SCRIPTS_URL = "scripts.js";
var SCRIPTS_BACKUP_URL = "new_" + SCRIPTS_URL;
var MODERATOR_MAX_BAN_LENGTH = 24 * 60 * 60; // in seconds
var MAIN_CHANNEL = "Dragonspiral Tower";
var dreamWorldPokemon = {};
var silence = false;

var Tournament = (function() {

var TOURNAMENT_INACTIVE = 0;
var TOURNAMENT_SIGNUPS  = 1;
var TOURNAMENT_ACTIVE   = 2;

function Tournament() {
  this.initialize();
}

Tournament.prototype.initialize = function() {
  this.tier     = "StreetPKMN";
  this.state    = TOURNAMENT_INACTIVE;
  this.round    = 0;
  this.numSpots = 0;
  this.players  = [];
  this.matches  = [];
  this.losers   = {};
};

Tournament.prototype.create = function(user, tier, spots) {
  // only create new tournament if one is not already made.
  if (this.state != TOURNAMENT_INACTIVE) {
    announce(user.id, "A tournament is already underway!");
    return false;
  }
  
  // initialization
  this.initialize();
  this.state    = TOURNAMENT_SIGNUPS;
  this.tier     = tier;
  this.numSpots = parseInt(spots, 10);
  
  // print out tournament data for users.
  announce("A " + spots + "-man tournament has started! The tier is " + tier + ".");
  announce("Type /join to join the tournament.");
  return true;
};

Tournament.prototype.join = function(user) {
  // check if there's a tournament running first.
  if (this.state === TOURNAMENT_INACTIVE) {
    announce(user.id, "There is no tournament running!");
    return;
  }
  
  // check if player is/was already in tournament.
  if (this.players.indexOf(user.name) !== -1) {
    announce(user.id, "You are already in the tournament!");
    return;
  }
  if (this.losers[user.name]) {
    announce(user.id, "You already played in the tournament!");
    return;
  }
  
  // add player to tournament
  this.players.push(user.name);
  if (this.players.length > this.numSpots) {
    announce(user.name + " joined the tournament as substitute #" + (this.players.length - this.numSpots) + "!");
  } else {
    announce(user.name + " joined the tournament! Now " + this.players.length + "/" + this.numSpots + " filled.");
  }
  
  // start tournament if target spots reached.
  if (this.players.length === this.numSpots) {
    this.state = TOURNAMENT_ACTIVE;
    this.advanceRound();
  }
};

Tournament.prototype.tick = function(winner, loser) {
  if (this.isTourBattle(winner, loser)) {
    this.advanceWinner(winner, loser);
    if (this.matchesLeft() === 0) {
      this.advanceRound();
    } else {
      announce(winner.name + " won a tournament battle! " + this.matchesLeft() + " matches remain.");
    }
  }
};

// winner is apparently the first parameter.
Tournament.prototype.advanceWinner = function(winner, loser) {
  this.removeMatch(winner, loser);
  this.players.splice(this.players.indexOf(loser.name), 1);
  this.losers[loser.name] = true;
};

Tournament.prototype.advanceRound = function() {
  this.round++;
  if (this.players.length === 1) {
    var userName = this.players.pop();
    this.state = TOURNAMENT_INACTIVE;
    announce(userName + " wins the tournament! Congratulations!");
  } else {
    this.makeMatchups();
    announce("Round " + this.round + " has started! Matchups are:");
    for (var i = 0; i < this.matches.length; i++) {
      var match = this.matches[i];
      announce(match[0] + " vs. " + match[1]);
    }
  }
};

Tournament.prototype.makeMatchups = function() {
  var len = this.players.length;
  while (--len > 0) {
      var rand = Math.floor(Math.random() * (len + 1));
      var tmp  = this.players[len];
      this.players[len]  = this.players[rand];
      this.players[rand] = tmp;
  }
  
  len = Math.min(this.numSpots, this.players.length);
  this.matches = [];
  for (var i = 0; i < len; i += 2) {
    this.matches.push([this.players[i], this.players[i + 1]]);
  }
};

Tournament.prototype.isTourBattle = function(userName1, userName2) {
  for (var i = 0; i < this.matches.length; i++) {
    var match = this.matches[i];
    if ((match[0] === userName1 && match[1] === userName2)
        || (match[0] === userName2 && match[1] === userName1)) {
      return true;
    }
  }
  return false;
};

Tournament.prototype.findMatch = function(userName1, userName2) {
  for (var i = 0; i < this.matches.length; i++) {
    var match = this.matches[i];
    if (!userName2) {
      if (match[0] === userName1 || match[1] === userName1) {
        return i;
      }
    } else if ((match[0] === userName1 && match[1] === userName2)
        || (match[0] === userName2 && match[1] === userName1)) {
      return i;
    }
  }
  return -1;
};

Tournament.prototype.removeMatch = function(userName1, userName2) {
  var index = this.findMatch(userName1, userName2);
  if (index !== -1) {
    this.matches.splice(index, 1);
  }
};

Tournament.prototype.matchesLeft = function() {
  return this.matches.length;
};

Tournament.prototype.drop = function(user, playerName) {
  var index = this.players.indexOf(playerName);
  if (index !== -1) {
    this.removePlayer(playerName);
    announce(user.name + " dropped " + playerName + " from the tournament!");
  } else {
    announce(user.id, playerName + " is not in the tournament!");
  }
}

Tournament.prototype.dropout = function(user) {
  var index = this.players.indexOf(user.name);
  if (index !== -1) {
    this.removePlayer(user.name);
    announce(user.name + " dropped out of the tournament!");
  } else {
    announce(user.id, "You are not in the tournament!");
  }
};

Tournament.prototype.removePlayer = function(userName) {
  this.players.splice(this.players.indexOf(userName), 1);
  
  var matchIndex = this.findMatch(userName);
  if (matchIndex === -1) {
    return;
  }
  var match = this.matches[matchIndex];
  
  if (this.players.length >= this.numSlots) {
    // sub in someone
    var sub  = this.players[this.numSlots - 1];
    if (match[0] === userName) {
      match[0] = sub;
    } else {
      match[1] = sub;
    }
    announce(sub + " will be subbing in for " + userName + "!");
  } else {
    var opponent = (match[0] === userName) ? match[1] : match[0];
    this.matches.splice(matchIndex, 1);
    announce(opponent + " gets a bye unless someone joins!");
  }
};

Tournament.prototype.stop = function(user) {
  if (this.state !== TOURNAMENT_INACTIVE) {
    this.state = TOURNAMENT_INACTIVE;
    this.round = 0;
    announce("The tournament was canceled!");
  } else {
    announce(user.id, "There is no tournament running!");
  }
};

Tournament.prototype.isActive = function() {
  return this.state === TOURNAMENT_ACTIVE;
};

return new Tournament();
})();

function User(id) {
  this.id = id;
  this.ip = sys.ip(id);
  this.name = sys.name(id);
  this.auth = sys.auth(id);
  this.muted = false;
  this.lastMessages = [];
  this.lastMessageTime = 0;
  this.idle = sys.away(id);
}

User.prototype.authedFor = function(auth) {
  return this.auth >= auth;
}

User.prototype.run = function(command, args) {
  if (command in commands) {
    commands[command].apply(this, args);
  }
}

User.prototype.log = function(message) {
  if (this.isSpamming(message)) {
    sys.stopEvent();
    kick(this.name);
    return;
  }
  // todo: remove after running on server
  if (!this.lastMessages) {
    this.lastMessages = [];
  }
  
  this.lastMessages.unshift(message);
  if (this.lastMessages.length > 5) {
    this.lastMessages.pop();
  }
  this.lastMessageTime = getTime();
}

User.prototype.isSpamming = function(message) {
  if (this.authedFor(MODERATOR)) {
    return false;
  }
  
  if (timeDelta(this.lastMessageTime) < 50) {
    return true;
  }
  return false;
}

User.prototype.outranks = function(other) {
  if (typeof other === "number") {
    return this.auth > other;
  } else {
    return this.auth > other.auth;
  }
}

function getPlayer(player_name) {
  var player_id = sys.id(player_name);
  return SESSION.users(player_id);
}

// temporary until i figure out a nicer way of doing this.
var help = [
  [
    "** BASIC USER COMMANDS",
    "/ranking -- See your own ranking.",
    "/clearpass -- Clear your own password",
    "/auth group:name"
  ], [
    "** MODERATOR COMMANDS",
    "/kick user",
    "/k is aliased to /kick.",
    "/ban user -- bans user for " + MODERATOR_MAX_BAN_LENGTH / 60 / 60 + " hours.",
    "/ban user:duration -- duration is in hours. Maximum of " + MODERATOR_MAX_BAN_LENGTH / 60 / 60 + " hours.",
    "/b is aliased to /ban.",
    "/unban user",
    "/mute -- mutes whole server",
    "/mute user",
    "/mute user:duration",
    "/unmute user",
    "/wall message"
  ], [
    "** ADMINISTRATOR COMMANDS",
    "/ban user -- bans user permanently.",
    "/b is aliased to /ban."
  ], [
    "** OWNER COMMANDS",
    "/clearpass user -- Clear user's password."
  ]
];

/** All of these commands are run in the context of a User object. */
var commands = {};
function addCommand(commandName, func) {
  if (typeof commandName == "string") {
    commands[commandName] = func;
  } else {
    for (var i = 0; i < commandName.length; i++) {
      commands[commandName[i]] = func;
    }
  }
}

function addAuthCommand(auth, commandName, func) {
  addCommand(commandName, function() {
    if (this.authedFor(auth)) {
      func.apply(this, arguments);
    }
  });
}

function addModCommand(commandName, func) {
  addAuthCommand(MODERATOR, commandName, func);
}

function addAdminCommand(commandName, func) {
  addAuthCommand(ADMINISTRATOR, commandName, func);
}

function addOwnerCommand(commandName, func) {
  addAuthCommand(OWNER, commandName, func);
}

addCommand([ "help", "commands" ], function() {
  for (var i = 0; i <= this.auth; i++) {
    for (var j = 0; j < help[i].length; j++) {
      announce(this.id, help[i][j]);
    }
  }
});

addOwnerCommand("mod", function(playerName) {
  changeAuthIfLessThan(playerName, MODERATOR);
});

addOwnerCommand("admin", function(playerName) {
  changeAuthIfLessThan(playerName, ADMINISTRATOR);
});

addOwnerCommand("owner", function(playerName) {
  changeAuthIfLessThan(playerName, OWNER);
});

addOwnerCommand(["deauth", "demod", "deadmin", "deowner"], function(playerName) {
  changeAuth(playerName, USER);
});

addCommand("auth", function(type, token, newAuth) {
  if (type === "group") {
    var group = AUTH_VALUES[token.toUpperCase()];
    var list  = sys.dbAuths();
    list      = findGroupAuthLevel(group, list).sort();
    
    for (var i = 0, len = list.length; i < len; i++) {
      announce(this.id, list[i]);
    }
  } else if (type === "user") {
    if (newAuth) {
      if (this.authedFor(OWNER)) {
        changeAuth(token, newAuth);
        announce(this.id, "You set " + token + "'s authority level to " + newAuth + ".");
      } else {
        announce(this.id, "You're not allowed to set other people's auth!");
      }
    } else {
      var auth = getAuth(token);
      announce(this.id, token + "'s authority level is " + auth + ".");
    }
  } else {
    announce(this.id, "Invalid arguments.");
  }
});

addOwnerCommand("eval", function() {
  var stuff = toArray(arguments);
  sys.eval(stuff);
});

addCommand([ "idle", "away"], function() {
  this.idle = !this.idle;
  var status = this.idle ? "idle" : "available";
  sys.changeAway(this.id, this.idle);
  announce(this.id, "You are now " + status + ".");
});

addCommand("ranking", function(player_name) {
  var player = getPlayer(player_name) || this;
  var rank   = sys.ranking(player.id);
  var tier   = sys.tier(player.id);
  if (rank) {
    var possessive = player_name ? player_name + "'s" : "Your";
    announce(this.id, possessive + " rank in " + tier + " is " + rank
      + "/" + sys.totalPlayersByTier(tier) + " ["
      + sys.ladderRating(player.id) + " points / "
      + sys.ratedBattles(player.id) +" battles]!");
  } else {
    var noun = player_name ? player_name + " is" : "You are";
    announce(this.id, noun + " not ranked in " + tier + " yet!");
  }
});

addModCommand([ "kick", "k" ], function(player_name, reason) {
  var player = getPlayer(player_name);
  if (this.outranks(player)) {
    var message = this.name + " kicked " + player_name + ".";
    if (reason) {
      message += " (" + reason + ")";
    }
    announce(message);
    kick(player_name);
  }
});

addOwnerCommand("reload", function() {
  var id          = this.id;
  var old_scripts = sys.getFileContent(SCRIPTS_URL);
  sys.writeToFile(SCRIPTS_BACKUP_URL, old_scripts);
  
  if (arguments.length > 0) {
    var scriptURL = toArray(arguments).join(":");
    
    sys.webCall(scriptURL, function(res) {
      sys.changeScript(res, true);
      sys.writeToFile(SCRIPTS_URL, res);
      announce(id, "Script reloaded!");
    });
  } else {
    sys.system("curl -k -o " + SCRIPTS_URL + " " + REMOTE_SCRIPT_URL);
    var new_scripts = sys.getFileContent(SCRIPTS_URL);
    sys.changeScript(new_scripts, true);
    announce(id, "Script reloaded!");
  }
});

addOwnerCommand("rollback", function() {
  var id          = this.id;
  var old_scripts = sys.getFileContent(SCRIPTS_BACKUP_URL);
  sys.writeToFile(SCRIPTS_URL, old_scripts);
  sys.changeScript(old_scripts, true);
  announce(id, "Scripts rolled back!");
});

addOwnerCommand("reloadtiers", function() {
  sys.system("curl -k -o tiers.xml " + REMOTE_TIERS_URL);
  sys.reloadTiers();
});

addModCommand("wall", function() {
  var message = toArray(arguments).join(":");
  announce(this.name + ": " + message);
});

addModCommand([ "ban", "b" ], function(player_name, length, reason) {
  var auth = parseInt(sys.dbAuth(player_name), 10);
  var message;
  if (this.outranks(auth)) {
    if (length && /^(\d+[mshdyMw]?)+$/.test(length)) {
      length = parseLength(length);
    } else {
      reason = length;
      length = MODERATOR_MAX_BAN_LENGTH;
    }
    
    // limit mod bans
    if (this.auth === MODERATOR) {
      length = Math.min(length, MODERATOR_MAX_BAN_LENGTH);
    }
    
    message = player_name + " was banned by " + this.name + " for " + prettyPrintTime(length) + ".";
    if (reason) {
      message += " (" + reason + ")";
    }
    announce(message);
    ban(player_name, getTime() + length * 1000);
  }
});

addAdminCommand("silence", function() {
  silence = true;
  announce(this.name + " silenced the chat.");
});

addAdminCommand(["unsilence", "desilence"], function() {
  silence = false;
  announce(this.name + " lifted the silence on the chat.");
});

addAdminCommand(["permban", "permaban", "pb"], function(playerName, reason) {
  var auth = parseInt(sys.dbAuth(playerName), 10);
  if (this.outranks(auth)) {
    var message = playerName + " was banned by " + this.name + " for eternity.";
    if (reason) {
      message += " (" + reason + ")";
    }
    ban(playerName);
    announce(message);
  }
});

addAdminCommand("topic", function() {
  var new_topic = toArray(arguments).join(":");
  
});

addModCommand("unban", function(playerName) {
  var auth       = parseInt(sys.dbAuth(playerName), 10);
  var expiresKey = makeKey(playerName, "ban:expires");
  if (this.outranks(auth)) {
    var ip = sys.dbIp(playerName);
    if (ip === undefined) {
      announce(this.id, "No such user!");
    } else if (getValue(expiresKey)) {
      sys.unban(playerName);
      deleteValue(expiresKey);
      announce(this.name + " unbanned " + playerName + ".");
    } else {
      announce(this.id, "This player is not banned!");
    }
  }
});

addModCommand("ipunban", function(ip) {
  sys.unban(ip);
});

addModCommand("mute", function(player_name, length) {
  var player = getPlayer(player_name);
  if (this.outranks(player)) {
    if (player.muted) {
      announce(this.id, player_name + " is already muted!");
      return;
    }
    
    var message = this.name + " muted " + player_name;
    player.muted = true;
    
    if (length) {
      var key = makeKey(player.name, "muted");
      length = parseLength(length);
      setValue(key, getTime() + length);
      sys.delayedCall(function() {
        var expired = getValue(makeKey(player.name, "muted"), 0);
        if (parseInt(expired, 10) < getTime()) {
          player.muted = false;
          deleteValue(key);
        }
      }, length);
      message += " for " + prettyPrintTime(length);
    }
    
    announce(message + ".");
  }
});

addModCommand("unmute", function(playerName) {
  var player = getPlayer(playerName);
  if (this.outranks(player)) {
    if (player.muted) {
      var key = makeKey(player.name, "muted");
      player.muted = false;
      deleteValue(key);
      announce(this.name + " unmuted " + playerName + ".");
    } else {
      announce(this.id, playerName + " is not muted!");
    }
  }
});

addCommand("tiers", function() {
  announce(this.id, "Smogon tiers: http://tinyurl.com/smtiers");
});

addCommand("dw", function() {
  announce(this.id, "Released Dream World content: http://tinyurl.com/dwareas and http://tinyurl.com/dwpkmn");
});

addCommand("clearpass", function(player_name) {
  if (player_name === undefined) {
    sys.clearPass(this.name);
    announce(this.id, "Your password was cleared.");
  } else if (this.authedFor(OWNER)) {
    sys.clearPass(player_name);
    announce(this.id, "You cleared " + player_name + "'s password.");
  }
});

// destroys a channel.
addOwnerCommand("destroy", function() {
  var channelId = sys.channelId(toArray(arguments).join(":"));
  if (channelId) {
    var players   = sys.playersOfChannel(channelId);
    for (var i = 0, len = players.length; i < len; i++) {
      sys.kick(players[i], channelId);
    }
  }
});

// Tournament wrappers
addAdminCommand("tour", function(tier, spots) {
  Tournament.create(this, tier, spots);
});

addCommand(["j", "join"], function() {
  Tournament.join(this);
});

addCommand("dropout", function() {
  Tournament.dropout(this);
});

addModCommand("drop", function(playerName) {
  Tournament.drop(this, playerName);
});

addModCommand("stop", function() {
  Tournament.stop(this);
});

/*******************\
* Tiers/ban lists   *
\*******************/
var BANS = {};
function makeBan(tier, banObject) {
  if (!BANS[tier]) {
    BANS[tier] = {};
  }
  for (var k in banObject) {
    if (banObject.hasOwnProperty(k)) {
      if (!BANS[tier][k]) {
        BANS[tier][k] = [];
      }
      var array = banObject[k];
      for (var i = 0; i < array.length; i++) {
        if (BANS[tier][k].indexOf(array[i]) === -1) {
          BANS[tier][k].push(array[i]);
        }
      }
    }
  }
}

function makeBlanketBan(banObject) {
  var tierList = sys.getTierList();
  for (var k in tierList) {
    if (banObject.hasOwnProperty(k)) {
      makeBan(k, banObject);
    }
  }
}

function hasValidTier(playerName, toTier) {
  var banObject = BANS[toTier];
  var counter = 0;
  for (var k in banObject) {
    if (banObject.hasOwnProperty(k)) {
      counter++;
    }
  }
  
  for (var i = 0; i < 6; i++) {
    var ability = sys.ability(sys.teamPokeAbility(sys.id(playerName), i));
    var index   = banObject.abilities.indexOf(ability);
    if (index !== -1) {
      banObject.abilities.splice(index, 1);
      counter--;
    }
  }
  
  return counter > 0;
}

makeBan("Standard OU", {
  abilities : [ "Drizzle", "Swift Swim" ]
});

makeBlanketBan({
  abilities : [ "Moody" ]
});

/*******************\
* Script wrappers   *
\*******************/
function kick(playerName) {
  var id = sys.id(playerName);
  if (id) {
    sys.kick(id);
  }
}

function ban(playerName, expires) {
  var banKey = makeKey(playerName, "ban");
  setValue(banKey + ":expires", expires || 0);
  kick(playerName);
  if (!expires) {
    sys.ban(playerName);
  }
}

/*******************\
* Registry helpers  *
\*******************/
function makeKey(playerName) {
  var arr = toArray(arguments, 1);
  arr.unshift(sys.dbIp(playerName));
  return arr.join(":");
}

function getValue(key, defaultValue) {
  return sys.getVal(key) || defaultValue;
}

function setValue(key, value) {
  sys.saveVal(key, value);
}

function deleteValue(key) {
  sys.removeVal(key);
}

/*******************\
* Time helpers      *
\*******************/
function parseLength(length) {
  var groups = length.match(/\d+[mshdyMw]?/g);
  var time   = 0;
  for (var i = 0, len = groups.length; i < len; i++) {
    var first = parseInt(groups[i], 10);
    var last  = groups[i].substr(-1);
    switch (last) {
      case 's':
        time += parseInt(first, 10);
        break;
      case 'm':
        time += parseInt(first, 10) * 60;
        break;
      case 'd':
        time += parseInt(first, 10) * 60 * 60 * 24;
        break;
      case 'w':
        time += parseInt(first, 10) * 60 * 60 * 24 * 7;
        break;
      case 'M':
        time += parseInt(first, 10) * 60 * 60 * 24 * 30;
        break;
      case 'y':
        time += parseInt(first, 10) * 60 * 60 * 24 * 30 * 12;
        break;
      case 'h':
      default:
        time += parseInt(first, 10) * 60 * 60;
        break;
    }
  }
  return time;
}

function prettyPrintTime(seconds) {
  function _(by, next, text) {
    seconds = Math.floor(seconds / by);
    var mod = seconds % next;
    if (mod !== 0) {
      time.unshift(mod + " " + pluralize(text, mod));
    }
  }
  var time = [];
  _(1,  60, "second");
  _(60, 60, "minute");
  _(60, 24, "hour");
  _(24, 7,  "day");
  _(7,  4,  "week");
  _(4,  12, "month");
  _(12, seconds + 1, "year");
  return time.join(", ");
}

function getTime() {
  return +new Date;
}

function timeDelta(milliseconds) {
  return getTime() - milliseconds;
}

/*******************\
* Auth helpers      *
\*******************/
function findGroupAuthLevel(auth, list) {
  var arr = [];
  for (var i = 0, len = list.length; i < len; i++) {
    var userName = list[i];
    var userId   = sys.id(userName);
    var userAuth = sys.dbAuth(userName);
    if (userAuth == auth) {
      var status = userId ? " (Online)" : "";
      arr.push(userName + status);
    }
  }
  return arr;
}

function changeAuth(playerName, newAuth) {
  var player = getPlayer(playerName);
  if (player) {
    player.auth = newAuth;
  }
  sys.changeDbAuth(playerName, newAuth);
}

function changeAuthIfLessThan(playerName, newAuth, permanent) {
  if (getAuth(playerName) < newAuth) {
    changeAuth(playerName, newAuth, permanent);
  }
}

function getAuth(playerName) {
  var id = sys.id(playerName);
  if (id) {
    return sys.auth(id);
  } else {
    return sys.dbAuth(playerName);
  }
}

/*******************\
* Chat helpers      *
\*******************/
function announce(player_id, message) {
  if (message === undefined) {
    message = player_id;
    sys.sendAll("*** " + message);
  } else {
    sys.sendMessage(player_id, "*** " + message);
  }
}

function sanitize(message) {
  // whitelist includes: a-zA-Z0-9_, -, space, {}[]/\()[]!@#$%^&*"'?<>+=`~|.,:;
  message = message.replace(/[^\w\-\[\]\/\\\(\)\<\>\!\@\#\$\%\^\&\*\~\`\=\+\"\'\,\.\?\{\}\;\:\| ]/g, "");
  message = message.replace(/^\s+/, "");
  message = message.replace(/\s+$/, "");
  return message;
}

function pluralize(word, number) {
  return number !== 1 ? word + "s" : word;
}

/*******************\
* Generic helpers   *
\*******************/
function compact(array) {
  new_array = [];
  for (var i = 0; i < array.length; i++) {
    if (array[i]) {
      new_array.push(array[i]);
    }
  }
  return new_array;
}

function toArray(args, startIndex) {
  startIndex = startIndex || 0;
  var array  = [];
  for (var i = startIndex, len = args.length; i < len; i++) {
    array.push(args[i]);
  }
  return array;
}

function inArray(array, element) {
  for (var i = 0, len = array.length; i < len; i++) {
    if (array[i] == element) {
      return true;
    }
  }
  return false;
}

/*******************\
* PO Factories      *
\*******************/
SESSION.registerUserFactory(User);

/*******************\
* Starter scripts   *
\*******************/
function serverStartUp() {
  // update existing User prototypes
  sys.playerIds().forEach(function(id) {
    var user = SESSION.users(id);
    if (user) {
      user.__proto__ = User.prototype;
    }
  });
  
  loadDreamWorldPokemon();
}

function beforeLogIn(player_id) {
  var player_name = sys.name(player_id);
  if (/[^\w-\[\]\. ]/g.test(player_name)) {
    announce(player_id, "Please do not use special characters in your name.");
    sys.stopEvent();
    return;
  }
  
  // unban users
  var expireKey = makeKey(player_name, "ban:expires");
  var expires   = parseInt(getValue(expireKey), 10);
  if (expires > 0) {
    if (expires > getTime()) {
      sys.stopEvent();
      return;
    } else {
      deleteValue(expireKey);
    }
  }
}

function afterLogIn(player_id) {
  var user    = SESSION.users(player_id);
  var key     = makeKey(user.name, "muted");
  var expired = parseInt(getValue(key, 0), 10);
  if (expired > getTime()) {
    user.muted = true;
  } else {
    deleteValue(key);
  }
}

function droughtCheck(src, tier){
if (!tier) tier = sys.tier(src);
    if (tier != "Standard UU") return; 
    for(var i = 0; i <6; ++i){
        if(sys.ability(sys.teamPokeAbility(src, i)) == "Drought"){
        normalbot.sendMessage(src, "Drought is not allowed in Standard UU")
      sys.stopEvent()
        sys.changeTier(src, "StreetPKMN")
        return;
        }
    }
}

function swiftSwimCheck(src, tier){
    if (!tier) tier = sys.tier(src);
    if (tier != "Standard OU") return; 
    for(var i = 0; i <6; ++i){
        if(sys.ability(sys.teamPokeAbility(src, i)) == "Drizzle"){
            for(var j = 0; j <6; ++j){
                if(sys.ability(sys.teamPokeAbility(src, j)) == "Swift Swim"){
                    announce(src, "You cannot have the combination of Swift Swim and Drizzle in Standard OU");
                    sys.stopEvent();
                    sys.changeTier(src, "StreetPKMN");
                    return;
                }
            }
        }
    }
}

function dreamWorldAbilitiesCheck(src, se) {
    if (sys.gen(src) < 5)
        return;

    if (["StreetPKMN", "Dream World OU", "Dream World Ubers", "Challenge Cup"].indexOf(sys.tier(src)) != -1) {
        return; // don't care about these tiers
    }

    for (var i = 0; i < 6; i++) {
        var x = sys.teamPoke(src, i);
        if (x != 0 && sys.hasDreamWorldAbility(src, i)  && (!(x in dreamWorldPokemon) || (breedingpokemons.indexOf(x) != -1  && sys.compatibleAsDreamWorldEvent(src, i) != true))) {
            if (se) {
                if (!(x in dreamWorldPokemon))
                    announce(src, "" + sys.pokemon(x) + " is  not allowed with a Dream World ability in this tier. Change it in the  teambuilder.");
                else
                    announce(src, "" + sys.pokemon(x) + "  has to be Male and have no egg moves with its Dream World ability in  " +  sys.tier(src) + " tier. Change it in the teambuilder.");
            }
            if (sys.tier(src) == "Standard OU" && sys.hasLegalTeamForTier(src, "Dream World OU")) {
                sys.changeTier(src, "Dream World OU");
            } else if (sys.tier(src) == "Standard OU" && sys.hasLegalTeamForTier(src, "Dream World Ubers")) {
                sys.changeTier(src, "Dream World Ubers");
            } else if (sys.tier(src) == "Standard Ubers") {
                sys.changeTier(src, "Dream World Ubers");
            }
            else if (sys.tier(src) == "Standard UU" && sys.hasLegalTeamForTier(src, "Dream World OU")) {
                sys.changeTier(src, "Dream World OU");
            }
            else if (sys.tier(src) == "Standard UU" && sys.hasLegalTeamForTier(src, "Dream World Ubers")) {
                sys.changeTier(src, "Dream World Ubers");
            }
            else if (sys.tier(src) == "Standard RU" && sys.hasLegalTeamForTier(src, "Dream World OU")) {
                sys.changeTier(src, "Dream World OU");
            } else if (sys.tier(src) == "Standard RU" && sys.hasLegalTeamForTier(src, "Dream World Ubers")) {
                sys.changeTier(src, "Dream World Ubers");
            }
            else if (sys.tier(src) == "Standard LC" && sys.hasLegalTeamForTier(src, "Dream World OU")) {
                sys.changeTier(src, "Dream World OU");
            }else {
                if (se)
                    sys.changePokeNum(src, i, 0);

            }
            if (se)
                sys.stopEvent();
        }
    }
}
var inpokemons = ["Remoraid", "Bidoof", "Snorunt", "Smeargle", "Bibarel", "Octillery", "Glalie"];

for(var i = 0; i < inpokemons.length; i++) {
  inpokemons[i] = sys.pokeNum(inpokemons[i]);
}

function loadDreamWorldPokemon() {
  var pokemonList = sys.getFileContent("dwpokemon.txt").split(/\s*\n\s*/);
  for (var i = 0, len = pokemonList.length; i < len; i++) {
    var pokemonName = pokemonList[i];
    dreamWorldPokemon[sys.pokeNum(pokemonName)] = pokemonName;
  }
}

var breedingpokemons = ["Bulbasaur", "Ivysaur", "Venusaur", "Charmander", "Charmeleon", "Charizard", "Squirtle", "Wartortle", "Blastoise", "Croagunk", "Toxicroak", "Turtwig", "Grotle", "Torterra", "Chimchar", "Monferno", "Infernape", "Piplup", "Prinplup", "Empoleon", "Treecko", "Grovyle", "Sceptile", "Torchic", "Combusken", "Blaziken", "Mudkip", "Marshtomp", "Swampert", "Mamoswine", "Togekiss"];
breedingpokemons = breedingpokemons.map(function(p) { return sys.pokeNum(p); });

function moodyCheck(src, se) {
    if (["Standard Uber, Standard OU, Standard UU, Standard RU, Standard LC"].indexOf(sys.tier(src)) == -1) {
        return; // only care about these tiers
    }
    for (var i = 0; i < 6; i++) {
        var x = sys.teamPoke(src, i);

        if (x != 0 && inpokemons.indexOf(x) != -1 && sys.hasDreamWorldAbility(src, i)) {
            if (se)
                announce(src, "+CheckBot: " + sys.pokemon(x) + "   is not allowed with Moody in this tier. Change it in the  teambuilder.");
                sys.changeTier(src, "StreetPKMN");
            if (se)
                sys.stopEvent();
        }
    }
}

function afterChangeTeam(playerId) {
  var user = SESSION.users(playerId);
  user.name = sys.name(playerId);
  dreamWorldAbilitiesCheck(playerId, false);
  moodyCheck(playerId, false);
  swiftSwimCheck(playerId);
  droughtCheck(playerId);
}

function afterBattleEnded(winner, loser, result, battleId) {
  if (Tournament.isActive() && result !== "tie") {
    winner = SESSION.users(winner);
    loser  = SESSION.users(loser);
    Tournament.tick(winner, loser);
  }
}

function beforeBattleMatchup(src, dest, clauses, rated, mode) {
  if (sys.tier(src) == sys.tier(dest)) {
    dreamWorldAbilitiesCheck(src, true);
    dreamWorldAbilitiesCheck(dest, true);
    moodyCheck(src, true);
    moodyCheck(dest, true);
  }
}

function beforeChallengeIssued(src, dest, clauses, rated, mode) {
  if (sys.tier(src) == sys.tier(dest)) {
    dreamWorldAbilitiesCheck(src, true);
    dreamWorldAbilitiesCheck(dest, true);
    moodyCheck(src, true);
    moodyCheck(dest, true);
  }
}

function beforeChangeTier(playerId, oldTier, newTier) {
  swiftSwimCheck(playerId, newTier);
  droughtCheck(playerId, newTier);
  /*
  if (!hasValidTier(playerId, newTier)) {
    sys.stopEvent();
    announce(playerId, "You cannot switch to this tier.");
  }
  */
}

function beforeChannelCreated(channelId, channelName, playerId) {
  var user = SESSION.users(playerId);
  if (!user.authedFor(MODERATOR) && channelName != MAIN_CHANNEL) {
    sys.stopEvent();
  }
}

function beforeChatMessage(player_id, message, channelId) {
  var user = SESSION.users(player_id);
  message  = sanitize(message);
  sys.stopEvent();
  if (message.length === 0) {
    return;
  }
  
  if (message[0] === '/' && message.length > 1) {
    message     = message.substr(1);
    var pieces  = message.split(/\s+/);
    var command = pieces.shift();
    pieces      = compact(pieces.join(" ").split(":"));
    user.run(command, pieces);
    return;
  }
  
  if (user.muted) {
    return;
  }
  
  if (!user.authedFor(MODERATOR) && silence) {
    return;
  }
  
  user.log(message);
  sys.sendAll(user.name + ": " + message, channelId);
}

({
  serverStartUp         : serverStartUp,
  beforeLogIn           : beforeLogIn,
  afterLogIn            : afterLogIn,
  afterBattleEnded      : afterBattleEnded,
  afterChangeTeam       : afterChangeTeam,
  beforeBattleMatchup   : beforeBattleMatchup,
  beforeChallengeIssued : beforeChallengeIssued,
  beforeChangeTier      : beforeChangeTier,
  beforeChannelCreated  : beforeChannelCreated,
  beforeChatMessage     : beforeChatMessage
})
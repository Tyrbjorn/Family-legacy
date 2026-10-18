import fs from 'fs';
const w=(n,o)=>fs.writeFileSync('data/'+n+'.json',JSON.stringify(o,null,1));
const S=(id,name,family,stat,icon)=>({id,name,family,stat,icon});
w('skills',[S('swordsmanship','Swordsmanship','combat','STR','⚔️'),S('archery','Archery','combat','AGI','🏹'),S('shield','Shield','combat','VIT','🛡️'),S('brawling','Brawling','combat','STR','👊'),
S('fire','Fire Magic','magic','INT','🔥'),S('frost','Frost Magic','magic','INT','❄️'),S('healing','Healing','magic','WIL','✨'),S('arcana','Arcana','magic','INT','🔮'),
S('smithing','Smithing','craft','STR','🔨'),S('carpentry','Carpentry','craft','STR','🪚'),S('alchemy','Alchemy','craft','INT','⚗️'),S('tailoring','Tailoring','craft','AGI','🧵'),
S('foraging','Foraging','gathering','AGI','🌿'),S('mining','Mining','gathering','STR','⛏️'),S('hunting','Hunting','gathering','AGI','🦌'),
S('haggling','Haggling','social','CHA','💰'),S('etiquette','Etiquette','social','CHA','🎩'),S('leadership','Leadership','social','CHA','📣'),
S('reading','Reading','lore','INT','📖'),S('history','History','lore','INT','📜'),S('monsterlore','Monster Lore','lore','WIL','🐉')]);
w('classes',[
{id:'fighter',name:'Fighter',tier:0,stats:['STR','VIT'],cpSkills:['swordsmanship','shield','brawling'],icon:'🗡️'},
{id:'scout',name:'Scout',tier:0,stats:['AGI','CHA'],cpSkills:['archery','hunting','foraging'],icon:'🏹'},
{id:'apprentice',name:'Apprentice',tier:0,stats:['INT','WIL'],cpSkills:['fire','frost','arcana'],icon:'🪄'},
{id:'knight',name:'Knight',tier:1,from:'fighter',req:{swordsmanship:25,shield:25},cost:500,stats:['STR','VIT'],cpSkills:['swordsmanship','shield','leadership'],cpMult:1.6,icon:'🛡️'},
{id:'duelist',name:'Duelist',tier:1,from:'fighter',req:{swordsmanship:30,brawling:20},cost:500,stats:['STR','AGI'],cpSkills:['swordsmanship','brawling'],cpMult:1.6,icon:'🤺'},
{id:'ranger',name:'Ranger',tier:1,from:'scout',req:{archery:25,hunting:25},cost:500,stats:['AGI','VIT'],cpSkills:['archery','hunting','foraging'],cpMult:1.6,icon:'🌲'},
{id:'rogue',name:'Rogue',tier:1,from:'scout',req:{archery:20,haggling:25},cost:500,stats:['AGI','CHA'],cpSkills:['archery','brawling','haggling'],cpMult:1.6,icon:'🗝️'},
{id:'elementalist',name:'Elementalist',tier:1,from:'apprentice',req:{fire:25,frost:25},cost:500,stats:['INT','WIL'],cpSkills:['fire','frost'],cpMult:1.6,icon:'🌩️'},
{id:'scholar',name:'Scholar',tier:1,from:'apprentice',req:{arcana:25,reading:25},cost:500,stats:['INT','INT'],cpSkills:['arcana','reading','history'],cpMult:1.6,icon:'🎓'}]);
w('traits',[{id:'quick',name:'Quick Learner',xp:0.1},{id:'frail',name:'Frail',life:-5},{id:'charming',name:'Charming',court:0.5},{id:'hardy',name:'Hardy',life:5},{id:'thrifty',name:'Thrifty',coin:0.1},{id:'brave',name:'Brave',cp:0.1},{id:'dreamer',name:'Dreamer',xp:0.05,court:0.2},{id:'lazy',name:'Lazy',xp:-0.1}]);
w('buildings',[
{id:'house',name:'House',icon:'🏠',max:5,cost:{coin:150,wood:30},desc:'+2 bedrooms per level',start:1},
{id:'farm',name:'Farm',icon:'🌾',max:5,cost:{coin:80,wood:15},desc:'+5 Food/day per level',start:1},
{id:'lumber',name:'Lumber Camp',icon:'🪵',max:5,cost:{coin:100},desc:'+3 Wood, +1 Stone/day per level',start:0},
{id:'yard',name:'Training Yard',icon:'🎯',max:5,cost:{coin:200,wood:40,stone:20},desc:'Idle XP efficiency +5% per level',start:0},
{id:'library',name:'Library',icon:'📚',max:5,cost:{coin:250,wood:50,stone:30},desc:'+2% Lore/Magic XP & +1% inheritance per level',start:0},
{id:'hourglass',name:'Hourglass Tower',icon:'⏳',max:2,cost:{coin:600,wood:80,stone:80},desc:'Turbo cap +30 min, offline cap +2h per level',start:0}]);
w('furniture',[
{id:'bookshelf',name:'Bookshelf',icon:'📚',cost:{coin:60,wood:10},bonus:{skill:'reading',xp:0.05}},
{id:'bed',name:'Comfy Bed',icon:'🛏️',cost:{coin:80,wood:15},bonus:{rest:0.2}},
{id:'trophy',name:'Trophy Rack',icon:'🦌',cost:{coin:120,wood:20},bonus:{renown:1}},
{id:'dummy',name:'Training Dummy',icon:'🪆',cost:{coin:70,wood:15},bonus:{family:'combat',xp:0.03}},
{id:'desk',name:'Writing Desk',icon:'🖋️',cost:{coin:90,wood:15},bonus:{family:'lore',xp:0.03}},
{id:'crystal',name:'Scrying Crystal',icon:'🔮',cost:{coin:200,stone:20},bonus:{family:'magic',xp:0.03}},
{id:'mirror',name:'Vanity Mirror',icon:'🪞',cost:{coin:100,stone:5},bonus:{court:0.2}},
{id:'pantry',name:'Pantry',icon:'🥫',cost:{coin:60,wood:20},bonus:{food:2}},
{id:'cradle',name:'Cradle',icon:'🧸',cost:{coin:90,wood:15},bonus:{childxp:0.25}},
{id:'strongbox',name:'Strongbox',icon:'🧰',cost:{coin:150,stone:15},bonus:{coin:0.05}}]);
const slots=['weapon','offhand','armor','accessory'];const rar=['Common','Fine','Rare','Epic'];
const iname={weapon:['Rusty Sword','Hunting Bow','Oak Staff','Iron Sword','Yew Longbow','Ember Wand','Steel Blade','Elven Bow','Frost Rod','Knight Sabre'],offhand:['Buckler','Quiver','Spell Tome','Kite Shield','Lucky Charm','Grimoire','Tower Shield','Runed Orb'],armor:['Padded Vest','Leather Jerkin','Apprentice Robe','Chain Shirt','Ranger Cloak','Mage Robe','Scale Mail','Shadow Leathers','Archmage Mantle','Plate Cuirass'],accessory:['Copper Ring','Wolf Tooth','Silver Locket','Owl Feather','Ring of Vigor','Amulet of Wit','Gilded Brooch','Signet Ring','Moonstone','Dragon Scale','Phoenix Plume','Heart Locket']};
const items=[];for(const s of slots)iname[s].forEach((n,i)=>items.push({id:n.toLowerCase().replace(/[^a-z]+/g,'_'),name:n,slot:s,rarity:rar[Math.min(3,Math.floor(i/3))],cp:Math.round((i+1)*(s==='weapon'?4:s==='accessory'?2:3)),value:(i+1)*25}));
items.push({id:'flowers',name:'Wildflowers',slot:'gift',rarity:'Common',affinity:8,value:10},{id:'chocolate',name:'Honey Cakes',slot:'gift',rarity:'Fine',affinity:15,value:30});
w('items',items);
const ids=items.map(i=>i.id);const pick=(a,b)=>ids.slice(a,b);
const Q=(id,name,region,type,cp,days,risk,reward,skill,loot)=>({id,name,region,type,cp,days,risk,reward,skill,loot});
const W=items.filter(i=>i.slot!=='gift');const low=W.filter(i=>i.rarity==='Common'||i.rarity==='Fine').map(i=>i.id),hi=W.filter(i=>i.rarity!=='Common').map(i=>i.id);
w('regions',[{id:'outskirts',name:'Village Outskirts',cp:10,icon:'🏘️'},{id:'forest',name:'Old Forest',cp:50,icon:'🌲'}]);
w('quests',[
Q('rats','Rats in the Cellar','outskirts','errand',0,2,'safe',{coin:25},'brawling',[]),
Q('letters','Deliver Letters','outskirts','errand',0,2,'safe',{coin:20},'etiquette',[]),
Q('herbs','Gather Herbs','outskirts','hunt',3,3,'safe',{coin:10,food:10},'foraging',['flowers']),
Q('firewood','Chop Firewood','outskirts','errand',3,3,'safe',{coin:15,wood:15},'carpentry',[]),
Q('lostgoat','Find the Lost Goat','outskirts','errand',5,3,'safe',{coin:35},'hunting',[]),
Q('wolves','Wolf Pack','outskirts','hunt',10,4,'risky',{coin:60,food:15},'hunting',low),
Q('quarry','Clear the Old Quarry','outskirts','hunt',12,5,'safe',{coin:40,stone:25},'mining',[]),
Q('bandit_scout','Bandit Lookout','outskirts','hunt',15,4,'risky',{coin:90},'swordsmanship',low),
Q('fair','Harvest Fair Duty','outskirts','errand',8,3,'safe',{coin:50,food:20},'haggling',['chocolate']),
Q('tutor','Tutor the Miller\'s Son','outskirts','errand',10,4,'safe',{coin:55},'reading',[]),
Q('goblins','Goblin Burrow','outskirts','dungeon',20,6,'risky',{coin:140},'swordsmanship',low),
Q('haunt','Haunted Mill','outskirts','dungeon',25,6,'deadly',{coin:220},'arcana',low,),
Q('caravan','Escort the Caravan','outskirts','errand',30,7,'risky',{coin:200},'leadership',low),
Q('mushrooms','Glowcap Mushrooms','forest','hunt',50,5,'safe',{coin:80,food:30},'alchemy',['flowers']),
Q('oaks','Fell the Ironoaks','forest','hunt',55,6,'safe',{coin:70,wood:60},'carpentry',[]),
Q('spiders','Spider Hollow','forest','dungeon',65,7,'risky',{coin:260},'fire',hi),
Q('dryad','Bargain with a Dryad','forest','errand',60,5,'safe',{coin:150},'etiquette',['chocolate']),
Q('stag','The White Stag','forest','hunt',75,8,'risky',{coin:300,food:40},'archery',hi),
Q('ruins','Moss-Covered Ruins','forest','dungeon',85,8,'risky',{coin:350,stone:40},'history',hi),
Q('witch','The Bog Witch','forest','dungeon',100,9,'deadly',{coin:600},'frost',hi),
Q('owlbear','Owlbear Den','forest','hunt',95,8,'risky',{coin:420},'shield',hi),
Q('shrine','Cleanse the Shrine','forest','errand',70,6,'safe',{coin:200},'healing',[]),
Q('poachers','Drive off Poachers','forest','hunt',80,6,'risky',{coin:280},'archery',hi),
Q('beasttome','Catalogue Beasts','forest','errand',60,7,'safe',{coin:160},'monsterlore',[]),
Q('treant','Elder Treant','forest','dungeon',130,10,'deadly',{coin:900,wood:100},'fire',hi)]);
w('tuning',{secPerDayActive:10,secPerDayOffline:20,daysPerYear:360,offlineCapHours:8,offlineEffActive:0.5,offlineEffIdle:0.2,idleEff:0.4,turboMult:3,turboChargeRatio:0.1,turboCapMin:60,turboMinMin:1,xpBase:50,xpGrowth:1.12,xpPerDay:20,softCap:[50,75],baseLifespan:70,courtAge:18,adultAge:16,childEvery:720,maxKidsPerCouple:3,inheritShare:0.10,buildCostMult:2.2,upkeepPerBuildingMonth:5,deadlyDeathChance:0.05,autosaveSec:30});

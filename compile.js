/**
 * Compile script for the json data. Basically, put all your txt files into
 * the txt/ directory, and this will compile it all into json. It assumes that
 * you've provided at least 'armor.txt', 'weapons.txt', 'TreasureClassEx.txt',
 * 'ItemTypes.txt', and 'monstats.txt'.
 *
 * @todo Refactor it, since I hacked it together fairly quickly.
 */

Object.defineProperty(Object.prototype, 'forEach', {
    value: function (func) {
        Object.keys(this).forEach(key => {
            func(this[key], key, this);
        });
    },
});

Object.defineProperty(Object.prototype, 'map', {
    value: function (func) {
        let ret = {};
    
        Object.keys(this).forEach(key => {
            ret[key] = func(this[key], key, this);
        });
    
        return ret;
    },
});

Object.defineProperty(Object.prototype, 'filter', {
    value: function (func = v => Boolean(v)) {
        let ret = {};
    
        Object.keys(this).forEach(key => {
            if(func.apply && func(this[key], key, this)) {
                ret[key] = this[key];
            }
        });
    
        return ret;
    },
});

Object.defineProperty(Object.prototype, 'toArray', {
    value: function () {
        let ret = [];
    
        for (let key in this) {
            ret.push([key, this[key]]);
        }
    
        return ret;
    },
});

const fs = require('fs');
const lineEnd = /[\n\r]+/g, fieldEnd = /\t/g, full = {};
const inDir = 'txt/';
const outDir = 'json/';
const files = fs.readdirSync(inDir).filter(fn => fn.slice(-4) === '.txt').map(fn => fn.slice(0, -4));
const rollingCalc = false;

function keySort(obj) {
	let keys = Object.keys(obj).sort(), ret = {};

	keys.forEach(key => {
		ret[key] = obj[key];
	});

	return ret;
}

const indexes = {
	armor: 'code',
	ArmType: 'Token',
	charstats: 'class',
	difficultylevels: 'Name',
	ElemTypes: 'Code',
	experience: 'Level',
	gems: 'code',
	inventory: 'class',
	ItemStatCost: 'Stat',
	ItemTypes: 'Code',
	Levels: 'Id',
	LvlMaze: 'Level',
	LvlPrest: 'Def',
	LvlTypes: 'Name',
	misc: 'code',
	Missiles: 'Id',
	MonMode: 'code',
	monstats: 'hcIdx',
	monstats2: 'Id',
	MonType: 'type',
	npc: 'npc',
	ObjMode: 'Token',
	Overlay: 'overlay',
	pettype: 'pet type',
	PlrMode: 'Code',
	PlrType: 'Token',
	PlayerClass: 'Code',
	Properties: 'code',
	Runes: 'Rune Name',
	SetItems: 'index',
	Sets: 'index',
	shrines: 'Code',
	skillcalc: 'code',
	skills: 'Id',
	SoundEnviron: 'Index',
	Sounds: 'Index',
	states: 'state',
	StorePage: 'Code',
	SuperUniques: 'hcIdx',
	TreasureClass: 'Treasure Class',
	TreasureClassEx: 'Treasure Class',
	weapons: 'code',
	WeaponClass: 'Code',
};

const filterValues = {
	'': true,
	'0': true,
	'unused': true,
	'none': true,
	'null': true,
};

function noDrop(e, nd, ...d) {
    e = e | 0;
    nd = nd | 0;
    d = d.reduce((t, v) => t + v | 0, 0);

    if (d < 1) {
        return Infinity;
    }

    return (d / (((nd + d) / nd)**e - 1)) | 0;
}

files.forEach(fn => {
	let data = fs.readFileSync(inDir + fn + '.txt').toString().split(lineEnd);
	let header = data.shift().split(fieldEnd);
	let indexColumn = header.indexOf(indexes[fn]);
	let usesVersion = header.includes('version');
	let expansion = false;
	let maxKeyCount = 0;

	if (indexColumn === -1) {
		console.log('Using default Index for:', fn);
	}

	full[fn] = data.reduce((obj, line, index) => {
		if (line.trim()) {
			line = line.split(fieldEnd).map(v => v.trim());

			if (line[0].toLowerCase() === 'expansion') {
				expansion = true;
			} else if (header.length === 1 || line.filter(Boolean).length > 1) {
				let key = indexColumn >= 0 ? (line[indexColumn]) : index;

				if (key !== undefined) {
					if (key !== '') {
						if (obj[key]) {
							throw new Error('Duplicate key ' + JSON.stringify(key) + ' in ' + fn);
						} else {
							let tmp = {};

							for (let c = 0; c < header.length; c++) {
								if (indexColumn >= 0 && c === indexColumn || !filterValues[line[c].toString().toLowerCase()]) {
									tmp[header[c] || 'unknown'] = +line[c] == line[c] ? +line[c] : line[c];
								}
							}

							let keyCount = Object.keys(tmp).length;

							if (keyCount > 0) {
								if (usesVersion) {
									if (tmp.version >= 100) {
										tmp.expansion = 1;
									}
								} else if (expansion) {
									tmp.expansion = 1;
								}

								obj[key] = tmp;

								if (indexColumn >= 0) {
									obj[key].lineNumber = index;
								}
							}

							maxKeyCount = Math.max(maxKeyCount, keyCount);
						}
					}
				} else {
					throw new Error('No viable key in: ' + fn + ' : ' + key);
				}
			}
		}

		return obj;
	}, {});

	if (maxKeyCount === 1) {
		full[fn] = Object.values(full[fn]).map(line => Object.values(line)[0]);
		console.log(fn, 'was reduced!');
	}

	if (fn === 'TreasureClassEx') {
		full[fn].forEach(tc => {
			let precalc = {};

			if (tc.Picks > 0) {
				let basetotal = 0;

				for (let c = 1; c <= 9; c++) {
					basetotal += tc['Prob' + c] | 0;
				}
	
				[1, 2, 3, 4, 5, 6, 7, 8].forEach(exp => {
					let nodrop = noDrop(exp, tc.NoDrop, basetotal);
	
					total = basetotal + nodrop;

					if (rollingCalc) {
						let otherChance = 1 - (nodrop / total);
		
						for (let i = 0; i < 100 && otherChance > 1e-30; i++) {
							for (let c = 1; c <= 9; c++) {
								if (tc['Item' + c]) {
									let prob = otherChance * (tc['Prob' + c] | 0) / total; 
									otherChance = Math.max(0, otherChance - (tc['Prob' + c] | 0) / total);
									precalc[exp] = precalc[exp] || {};
									precalc[exp][tc['Item' + c]] = precalc[exp][tc['Item' + c]] || 0;
									precalc[exp][tc['Item' + c]] += prob;
								}
							}
						}	
					} else {
						for (let c = 1; c <= 9; c++) {
							if (tc['Item' + c]) {
								let prob = (tc['Prob' + c] | 0) / total; 
								precalc[exp] = precalc[exp] || {};
								precalc[exp][tc['Item' + c]] = precalc[exp][tc['Item' + c]] || 0;
								precalc[exp][tc['Item' + c]] += prob;
							}
						}	
					}		
				});					
			}

			tc.precalc = precalc;
		});
	}

	if (fn === 'SuperUniques') {
		full[fn][0].areaId = 3;
		full[fn][1].areaId = 18;
		full[fn][2].areaId = 9;
		full[fn][3].areaId = 4;
		full[fn][4].areaId = 5;
		full[fn][5].areaId = 38;
		full[fn][6].areaId = 25;
		full[fn][7].areaId = 30;
		full[fn][9].areaId = 33;
		full[fn][10].areaId = 49;
		full[fn][11].areaId = 60;
		full[fn][12].areaId = 61;
		full[fn][13].areaId = 43;
		full[fn][14].areaId = 59;
		full[fn][15].areaId = 64;
		full[fn][16].areaId = 54;
		full[fn][17].areaId = 44;
		full[fn][18].areaId = 74;
		full[fn][20].areaId = 28;
		full[fn][21].areaId = 85;
		full[fn][22].areaId = 91;
		full[fn][23].areaId = 78;
		full[fn][24].areaId = 94;
		full[fn][25].areaId = 92;
		full[fn][26].areaId = 83;
		full[fn][27].areaId = 83;
		full[fn][28].areaId = 102;
		full[fn][29].areaId = 83;
		full[fn][30].areaId = 102;
		full[fn][31].areaId = 102;
		full[fn][36].areaId = 108;
		full[fn][37].areaId = 108;
		full[fn][38].areaId = 108;
		full[fn][39].areaId = 39;
		full[fn][40].areaId = 8;
		full[fn][41].areaId = 107;
		full[fn][42].areaId = 110;
		full[fn][43].areaId = 120;
		full[fn][44].areaId = 120;
		full[fn][45].areaId = 120;
		full[fn][47].areaId = 115;
		full[fn][48].areaId = 110;
		full[fn][49].areaId = 111;
		full[fn][50].areaId = 111;
		full[fn][51].areaId = 112;
		full[fn][52].areaId = 121;
		full[fn][53].areaId = 119;
		full[fn][56].areaId = 111;
		full[fn][59].areaId = 114;
		full[fn][60].areaId = 124;
		full[fn][61].areaId = 131;
		full[fn][62].areaId = 131;
		full[fn][63].areaId = 131;
		full[fn][64].areaId = 131;
		full[fn][65].areaId = 131;
	}

	if (fn === 'monstats') {
		full[fn][156].areaId = 37;
		full[fn][211].areaId = 73;
		full[fn][242].areaId = 102;
		full[fn][243].areaId = 108;
		full[fn][544].areaId = 132;
		full[fn][704].areaId = 136;
		full[fn][705].areaId = 136;
		full[fn][706].areaId = 135;
		full[fn][707].areaId = 133;
		full[fn][708].areaId = 134;
		full[fn][709].areaId = 136;
	}
});

files.forEach(fn => {
	fs.writeFileSync(outDir + fn + '.json', JSON.stringify(keySort(full[fn]), null, ' '));
});

const items = Object.assign(
	full.weapons,
	full.armor,
	full.misc
);

let atomic = {};
let atomicTypes = {};
let calcTC = x => Math.min(87, Math.max(1, Math.ceil((x || 0) / 3)) * 3);

[...Object.values(full.weapons), Object.values(full.armor)].forEach(item => {
	if (!item.spawnable) {
		return;
	}

	let tc = calcTC(item.level);

	function handleAtomic(itemType) {
		if (full.ItemTypes[itemType]) {
			if (full.ItemTypes[itemType].TreasureClass) {
				atomicTypes[itemType] = true;
				atomic[itemType + tc] = atomic[itemType + tc] || {};
				atomic[itemType + tc][item.code] = item.code;		
			}

			if (full.ItemTypes[itemType].Equiv1) {
				handleAtomic(full.ItemTypes[itemType].Equiv1);
			}

			if (full.ItemTypes[itemType].Equiv2) {
				handleAtomic(full.ItemTypes[itemType].Equiv2);
			}
		}
	}

	handleAtomic(item.type);
});

atomicTypes = Object.keys(atomicTypes);

for (let c = 3; c <= 87; c += 3) {
	atomicTypes.forEach(type => {
		atomic[type + c] = atomic[type + c] || {};
	});
}

atomic.forEach((atom, atomName) => {
	let precalc = {}, total = 0, otherChance = 1;

	atom = atom.map(itc => {
		let rarity = full.ItemTypes[items[itc].type].Rarity | 0;
		total += rarity;
		return rarity;
	}).map(chance => chance / total);

	atom.forEach((chance, itc) => {
		precalc[itc] = chance;
	});

	/* rolling computation
	for (let i = 0; i < 100 && otherChance > 1e-30; i++) {
		atom.forEach((chance, itc) => {
			let prob = otherChance * chance;
			otherChance *= 1 - chance;
			precalc[itc] = precalc[itc] || 0;
			precalc[itc] += prob;
		});
	}
	*/

	precalc.forEach((chance, itc) => {
		atomic[atomName][itc] = chance;
	});
});

full.atomic = atomic;
fs.writeFileSync(outDir + 'atomic.json', JSON.stringify(keySort(atomic), null, ' '));

const tcKey = [
	'TreasureClass1',
	'TreasureClass2',
	'TreasureClass3',
];

let groupsEx = {};

full.TreasureClassEx.forEach((tc, key) => {
	if (tc.group) {
		groupsEx[tc.group] = groupsEx[tc.group] || [];
		groupsEx[tc.group][tc.level|0] = key;
	}
});

groupsEx = groupsEx.map(group => {
	let length = group.length;
	group = Object.assign({}, group);
	group.length = length;
	return group;
});

fs.writeFileSync(outDir + 'TreasureClassGroupsEx.json', JSON.stringify(groupsEx, null, ' '));

delete full.Sounds;
delete full.Missiles;
delete full.objects;
delete full.LvlPrest;
delete full.inventory;
delete full.ItemStatCost;
delete full.ItemTypes;
delete full.MonMode;
delete full.Overlay;
delete full.PlrMode;
delete full.SoundEnviron;
delete full.states;
delete full.UniqueAppellation;
delete full.UniquePrefix;
delete full.UniqueSuffix;
delete full.UniqueUniqueTitle;
delete full.Aiparms;
delete full.Arena;
delete full.ArmType;
delete full.AutoMap;
delete full.belts;
delete full.bodylocs;
delete full.colors;
delete full.compcode;
delete full.Composit;
delete full.cubemod;
delete full.cubetype;
delete full.events;
delete full.gamble;
delete full.hiredesc;
delete full.HitClass;
delete full.lowqualityitems;
delete full.LvlWarp;
delete full.misscalc;
delete full.monai;
delete full.monequip;
delete full.MonItemPercent;
delete full.MonName;
delete full.MonPlace;
delete full.MonPreset;
delete full.MonProp;
delete full.monseq;
delete full.monsounds;
delete full.monstats2;
delete full.monumod;
delete full.objgroup;
delete full.ObjMode;
delete full.ObjType;
delete full.pettype;
delete full.PlrType;
delete full.qualityitems;
delete full.RarePrefix;
delete full.RareSuffix;
delete full.skillcalc;
delete full.skilldesc;
delete full.StorePage
delete full.WeaponClass;

fs.writeFileSync(outDir + 'aggregate.json', JSON.stringify(keySort(full)));

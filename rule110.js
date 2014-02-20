

var Tracker = function(duration) {
	this.timeout = duration + new Date().getTime() / 1000;
};

Tracker.prototype.shouldRun = function() {
	var t = new Date().getTime() / 1000;
	return (t < this.timeout);
};

// Hashlife for ECA.
// When traversed, the universe will look like a binary tree;
// however, nodes with same pattern are shared.
var HashCell = function(rule) {
	this.rule = rule;
};

HashCell.prototype.step = function(state) {
	var rule = this.rule;

	return _.map(state, function(v_c, ix) {
		var v_l = (ix - 1 < 0) ? state[state.length - 1] : state[ix - 1];
		var v_r = (ix + 1 >= state.length) ? state[0] : state[ix + 1];

		// Encode current neighbors to [0, 8) value.
		var v_enc = (v_l ? 4 : 0) | (v_c ? 2 : 0) | (v_r ? 1 : 0);

		// Lookup
		return (rule & (1 << v_enc)) != 0;
	});
};

// Immutable node representing 2^n slice of the universe.
// This constructor is overloaded:
// * single-value: hc, value
// * others: hc, left, right
var HashCellNode = function(hc, arg0, arg1, arg2) {
	this.hashcell = hc;
	if(arg1 === undefined) {
		this.level = 0;
		this.pattern = [arg0];
	} else {
		this.l = arg0;
		this.r = arg1;
		this.level = arg0.level + 1;
		console.assert(this.l.level === this.r.level);
		console.assert(this.level >= 1);

		if(this.level <= 2) {
			this.pattern = this.l.pattern.concat(this.r.pattern);
		}
	}
};

// Return a smaller node after 1 step.
// this = |* *|* *|
// ret  =   |+ +|
HashCellNode.prototype.step = function() {
	console.assert(this.level >= 2);
	if(this.level == 2) {
		var new_pattern = this.hashcell.step(this.pattern);
		return new HashCellNode(this.hashcell,
			new HashCellNode(this.hashcell, new_pattern[1]),
			new HashCellNode(this.hashcell, new_pattern[2]));
	} else {
		// We want to do this:
		// this = |0 1 2 3|4 5 6 7|
		// ret  =     |a b c d|
		//
		// We generate two shifted nodes and step them:
		// |a b| = |1 2 3 4|.step
		// |c d| = |3 4 5 6|.step
		var l_part = new HashCellNode(this.hashcell, this.l.l.r, this.l.r.l);
		var r_part = new HashCellNode(this.hashcell, this.r.r.l, this.r.l.r);
		var center = new HashCellNode(this.hashcell, this.l.r.r, this.r.l.l);

		var l_shifted = new HashCellNode(this.hashcell, l_part, center);
		var r_shifted = new HashCellNode(this.hashcell, center, r_part);

		return new HashCellNode(this.hashcell, l_shifted.step(), r_shifted.step());
	}
};



// Infinitely large, deferred elementary cellular automaton.
// No GUI code here.
var ECA = function(rule) {
	this.rule = rule;

	this.initial = function(x) {
		return (x == 0);
	};

	// cache tile
	this.tile_size = 200;
	this.tiles = {};
};

// To update a tile (ix, it), we use last values from (ix-1, it) and (ix+1, it).
// e.g. tile_size = 3
// |+++|+++|+++|
// -------------
// |-++|+++|++-|
// |--+|+++|+--|
// |---|+++|---|
ECA.prototype.updateTile = function(ix, it, tr) {
	if(!tr.shouldRun()) {
		return null;
	}

	var states = [];
	if(it == 0) {
		// Use supplied initial value function.
		var x0 = (ix - 1) * this.tile_size;
		var x1 = (ix + 2) * this.tile_size;

		var state = _.map(_.range(x0, x1), this.initial);	
		for(var t = 0; t < this.tile_size; t++) {
			states.push(state.slice(this.tile_size, this.tile_size * 2));
			state = this.step(state);
		}
	} else {
		// Use previous tiles' last values.
		var tn = this.getTile(ix - 1, it - 1, tr);
		var t0 = this.getTile(ix, it - 1, tr);
		var tp = this.getTile(ix + 1, it - 1, tr);
		if(tn === null || t0 === null || tp === null) {
			return null;
		}

		var state = tn[this.tile_size - 1].concat(
			t0[this.tile_size - 1]).concat(
			tp[this.tile_size - 1]);
		for(var t = 0; t < this.tile_size; t++) {
			state = this.step(state);
			states.push(state.slice(this.tile_size, this.tile_size * 2));
		}
	}
	return states;
};

// If immediate: may return null when it takes time to calculate the tile.
ECA.prototype.getTile = function(ix, it, tr) {
	console.assert(it >= 0);
	var index = [ix, it];
	if(this.tiles[index] === undefined) {
		var tile = this.updateTile(ix, it, tr);
		if(tile !== null) {
			this.tiles[index] = tile;
		}
		return tile;
	}
	return this.tiles[index];
};

// initial :: int -> bool
ECA.prototype.setInitialState = function(initial) {
	this.initial = initial;
	this.tiles = {};
};

ECA.prototype.step = function(state) {
	var rule = this.rule;

	return _.map(state, function(v_c, ix) {
		var v_l = (ix - 1 < 0) ? state[state.length - 1] : state[ix - 1];
		var v_r = (ix + 1 >= state.length) ? state[0] : state[ix + 1];

		// Encode current neighbors to [0, 8) value.
		var v_enc = (v_l ? 4 : 0) | (v_c ? 2 : 0) | (v_r ? 1 : 0);

		// Lookup
		return (rule & (1 << v_enc)) != 0;
	});
};

ECA.prototype.getTileSize = function() {
	return this.tile_size;
};


var Explorer110 = function() {
	var _this = this;
	this.eca = new ECA(110);

	this.patterns = {
		"ether": {
			pattern: this.patternFromString("11111000100110"),
			key_color: 'rgba(255, 0, 0, 0.8)',
			base_color: 'rgba(255, 200, 200, 0.8)',
		},
		"A": {
			//pattern: this.patternFromString("11111000100110100110"),
			pattern: this.patternFromString("1110"),
			key_color: 'rgba(0, 0, 255, 0.8)',
			base_color: 'rgba(200, 200, 255, 0.8)',
		}
	};
	var core_pattern = this.generateRepetition('ether', 5)
		.concat(this.generateRepetition('A', 1))
		.concat(this.generateRepetition('ether', 5))
		.concat(this.generateRepetition('A', 1))
		.concat(this.generateRepetition('ether', 5));

	this.eca.setInitialState(function(x) {
		var ether = _this.patterns["ether"].pattern;
		var n = ether.length;
		if(x < 0) {
			return ether[((x % n) + n) % n];
		} else if(x < core_pattern.length) {
			return core_pattern[x];
		} else {
			return ether[(x - core_pattern.length) % n];
		}

	});

	this.setInitialStateFromUI();

	
	_.each(this.patterns, function(entry, name) {
		var item = $('<li/>').addClass('list-group-item');
		item.append($('<span/>').text(name).css('color', entry.key_color));
		item.append(' : ' + _this.patternToString(entry.pattern));
		item.append(' N=' + entry.pattern.length);
		$('#ui_patterns').append(item);
	});
	
	// Window into ECA.
	// p<canvas> = p<ECA> * zoom + t
	this.zoom = 3;
	this.tx = 0;
	this.ty = 0;

	// cache tile
	this.tile_size = this.eca.getTileSize();
	this.tiles = {};

	this.setupGUI();
};

Explorer110.prototype.setupGUI = function() {
	var _this = this;

	// adjust canvas size
	$('#eca')[0].width = $('#col_eca').width();
	$('#eca')[0].height = $(window).height() - 150;

	$('#eca').mousewheel(function(event) {
		event.preventDefault();

		// p = event.offsetX,Y must be preserved.
		// p<canvas> = p<ECA> * zoom + t = p<ECA> * new_zoom + new_t

		var center_x_eca = (event.offsetX - _this.tx) / _this.zoom;
		var center_y_eca = (event.offsetY - _this.ty) / _this.zoom;
		_this.zoom = Math.min(10, Math.max(0.05, _this.zoom + event.deltaY * 0.1));

		_this.tx = event.offsetX - center_x_eca * _this.zoom;
		_this.ty = event.offsetY - center_y_eca * _this.zoom;
	});

	var dragging = false;
	var prev_ev = null;
	$('#eca').mousedown(function(event) {
		dragging = true;
	});

	$('#eca').mouseleave(function(event) {
		dragging = false;
		prev_ev = null;
	});

	$('#eca').mouseup(function(event) {
		dragging = false;
		prev_ev = null;
	});

	$('#eca').mousemove(function(event) {
		if(!dragging) {
			return;
		}

		if(prev_ev !== null) {
			_this.tx += event.clientX - prev_ev.clientX;
			_this.ty += event.clientY - prev_ev.clientY;
		}
		prev_ev = event;
	});

	$('#ui_cells').change(function(event) {
		_this.notifyUpdate();
	});

	$('#ui_highlight').change(function(event) {
		_this.notifyUpdate();
	});

	$('#ui_initial_left').keyup(function(event) {
		_this.setInitialStateFromUI();
	});

	$('#ui_initial_center').keyup(function(event) {
		_this.setInitialStateFromUI();
	});

	$('#ui_initial_right').keyup(function(event) {
		_this.setInitialStateFromUI();
	});

	$('#ui_apply_glider').click(function(event) {
		_this.setInitialStateFromGliders();
	})
};

Explorer110.prototype.setInitialStateFromGliders = function() {
	var a4 = this.patternFromString("1110111011101110");
	var a4pack = a4
		.concat(this.replicate(this.patterns["ether"].pattern, 27))
		.concat(a4)
		.concat(this.replicate(this.patterns["ether"].pattern, 23))
		.concat(a4)
		.concat(this.replicate(this.patterns["ether"].pattern, 25))
		.concat(a4);

	var bands = a4pack
		.concat(this.replicate(this.patterns["ether"].pattern, 649))
		.concat(a4pack)
		.concat(this.replicate(this.patterns["ether"].pattern, 649))
		.concat(a4pack);

	$('#ui_initial_left').val(this.patternToString(this.patterns["ether"].pattern));
	$('#ui_initial_center').val(this.patternToString(bands));
	$('#ui_initial_right').val(this.patternToString(this.patterns["ether"].pattern));
	this.setInitialStateFromUI();
};

Explorer110.prototype.replicate = function(pattern, n) {
	var ps = [];
	_.each(_.range(n), function() {
		ps = ps.concat(pattern);
	});
	return ps;
}

Explorer110.prototype.setInitialStateFromUI = function() {
	var pat_l = this.patternFromString($('#ui_initial_left').val());
	var pat_c = this.patternFromString($('#ui_initial_center').val());
	var pat_r = this.patternFromString($('#ui_initial_right').val());

	this.eca.setInitialState(function(x) {
		if(x < 0) {
			return pat_l[((x % pat_l.length) + pat_l.length) % pat_l.length];
		} else if(x < pat_c.length) {
			return pat_c[x];
		} else {
			return pat_r[(x - pat_c.length) % pat_r.length];
		}
	});
	this.tiles = {};
};

Explorer110.prototype.patternToString = function(pat) {
	return _.map(pat, function(v) {
		return v ? '1' : '0';
	}).join('');
};

Explorer110.prototype.patternFromString = function(s) {
	return _.map(s, function(v) {
		return v == '1';
	});
};

Explorer110.prototype.generateRepetition = function(name, n) {
	var result = [];
	_.each(_.range(n), function() {
		result = result.concat(this.patterns[name].pattern);
	}, this);
	return result;
};

Explorer110.prototype.notifyUpdate = function() {
	this.tiles = {};
};

// If immediate: may return null when it takes time to calculate the tile.
Explorer110.prototype.getTile = function(ix, it, tr) {
	var index = [ix, it];
	if(this.tiles[index] !== undefined) {
		return this.tiles[index];
	}

	var canvas = document.createElement('canvas');
	canvas.width = this.tile_size;
	canvas.height = this.tile_size;
	
	var ctx = canvas.getContext('2d');

	ctx.fillStyle = 'white';
	ctx.beginPath();
	ctx.rect(0, 0, this.tile_size, this.tile_size);
	ctx.fill();

	ctx.save();

	ctx.lineWidth = 0.1;
	ctx.beginPath();
	ctx.moveTo(-500, 0);
	ctx.lineTo(500, 0);
	ctx.strokeStyle = 'gray';
	ctx.stroke();

	var _this = this;
	var enable_cells = $('#ui_cells').is(':checked');
	var enable_highlight = $('#ui_highlight').is(':checked');


	var data = this.eca.getTile(ix, it, tr);
	var data_l = this.eca.getTile(ix - 1, it, tr);
	var data_r = this.eca.getTile(ix + 1, it, tr);
	if(data === null || data_l === null || data_r === null || !tr.shouldRun()) {
		return null;
	}

	for(var t = 0; t < this.tile_size; t++) {
		var state = data[t];

		if(enable_cells) {
			_.each(state, function(v, x) {
				ctx.beginPath();
				ctx.rect(x, t, 1, 1);

				ctx.fillStyle = v ? 'rgb(100, 100, 100)' : 'white';
				ctx.fill();
			});
		}

		if(enable_highlight) {
			var ext_state = data_l[t].concat(data[t]).concat(data_r[t]);

			_.each(ext_state, function(v, ext_x) {
				var x = ext_x - _this.tile_size;
				_.each(_this.patterns, function(entry) {
					var pattern = entry.pattern;

					var x_end = x + pattern.length;
					if(_.isEqual(ext_state.slice(x + _this.tile_size, x_end + _this.tile_size), pattern)) {
						ctx.beginPath();
						ctx.rect(x, t, pattern.length, 1);
						ctx.fillStyle = entry.base_color;
						ctx.fill();

						ctx.beginPath();
						ctx.rect(x, t, 1, 1);
						ctx.fillStyle = entry.key_color;
						ctx.fill();
					}
				});
			});
		}
	}
	ctx.restore();
	this.tiles[index] = canvas;
	return canvas;
};

Explorer110.prototype.redraw = function() {
	var _this = this;
	var ctx = $('#eca')[0].getContext('2d');
	
	ctx.fillStyle = 'white';
	ctx.beginPath();
	ctx.rect(0, 0, $('#eca')[0].width, $('#eca')[0].height);
	ctx.fill();

	// Draw visible tiles
	var tr = new Tracker(0.1);
	ctx.save();
	ctx.translate(this.tx, this.ty);
	ctx.scale(this.zoom, this.zoom);
	_.each(this.getVisibleTileIndices(), function(index) {
		var ix = index[0];
		var it = index[1];

		var tile = _this.getTile(ix, it, tr);
		if(tile !== null) {
			ctx.drawImage(tile, ix * _this.tile_size, it * _this.tile_size);
		} else {
			ctx.fillStyle = '#333';
			ctx.fillText("calculating", (ix + 0.5) * _this.tile_size, (it + 0.5) * _this.tile_size);
		}
	});
	ctx.restore();

	// Draw ruler (10x10 - 10x100)
	var exponent = Math.floor(Math.log(this.zoom) / Math.log(10));
	var fraction = this.zoom / Math.pow(10, exponent);

	ctx.save();
	ctx.translate(0, $('#eca')[0].height - 20);
	ctx.beginPath();
	ctx.rect(0, 0, 100, 20);
	ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
	ctx.fill();

	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(0, 15);
	ctx.lineTo(fraction * 10, 15);
	ctx.strokeStyle = '#020F80';
	ctx.stroke();

	ctx.fillStyle = '#020F80';
	ctx.fillText(10 * Math.pow(10, -exponent), 0, 10);
	ctx.restore();

	setTimeout(function() {
		_this.redraw();
	}, 100);
};


Explorer110.prototype.run = function() {
	this.redraw();
};

Explorer110.prototype.getVisibleTileIndices = function() {
	// p<canvas> = p<ECA> * zoom + t
	// p<ECA> = (p<canvas> - t) / zoom
	var x0 = (-this.tx) / this.zoom / this.tile_size;
	var x1 = ($('#eca')[0].width - this.tx) / this.zoom / this.tile_size;
	var y0 = Math.max(0, (-this.ty) / this.zoom / this.tile_size);
	var y1 = ($('#eca')[0].height - this.ty) / this.zoom / this.tile_size;

	var indices = [];
	_.each(_.range(Math.floor(y0), Math.ceil(y1)), function(iy) {
		_.each(_.range(Math.floor(x0), Math.ceil(x1)), function(ix) {
			indices.push([ix, iy]);
		});
	});
	return indices;
};


new Explorer110().run();

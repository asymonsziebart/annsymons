extends Node2D

## A polished vertical slice for the browser build.
## The world and character artwork are original generated assets. Gameplay,
## interactions, save data, and rendering code are original to this project.

enum Tool { HOE, SEEDS, WATER, HAND }
enum PlotState { WILD, TILLED, PLANTED, READY }

const VIEW := Vector2(1152.0, 648.0)
const WORLD_TEXTURE := preload("res://assets/farm-world.png")
const CHARACTER_TEXTURE := preload("res://assets/characters.png")
const SAVE_PATH := "user://callie-vallie-save.cfg"
const ROSE := Color("#d96b78")
const TEAL := Color("#236d73")
const HONEY := Color("#e8b85f")
const CREAM := Color("#fff3d6")
const INK := Color("#20342d")

var player: Sprite2D
var player_position := Vector2(555, 340)
var active_character := 0
var facing := 0 # front, back, left, right
var selected_tool := Tool.HOE
var coins := 50
var day := 1
var hour := 7.25
var seeds := 8
var harvested := 0
var plots: Array[Dictionary] = []
var message := "Welcome home. Press ? for controls."
var message_time := 7.0
var walk_time := 0.0
var is_moving := false
var help_open := false
var pollen: Array[Dictionary] = []

var character_names := ["Callie", "Vallie"]
var tool_names := ["Hoe", "Seeds", "Water", "Harvest"]


func _ready() -> void:
	_create_world()
	_create_plots()
	_load_game()
	_create_player()
	_create_pollen()
	queue_redraw()


func _create_world() -> void:
	var background := Sprite2D.new()
	background.texture = WORLD_TEXTURE
	background.position = VIEW * 0.5
	background.scale = Vector2(0.75, 0.75)
	background.z_index = -20
	add_child(background)

	# A warm bloom and subtle vignette give the still artwork more depth.
	var warmth := PointLight2D.new()
	var gradient := Gradient.new()
	gradient.colors = PackedColorArray([
		Color(1.0, 0.82, 0.45, 0.45),
		Color(1.0, 0.72, 0.3, 0.0),
	])
	var texture := GradientTexture2D.new()
	texture.gradient = gradient
	texture.width = 512
	texture.height = 512
	texture.fill = GradientTexture2D.FILL_RADIAL
	texture.fill_from = Vector2(0.5, 0.5)
	texture.fill_to = Vector2(1.0, 0.5)
	warmth.texture = texture
	warmth.position = Vector2(330, 120)
	warmth.energy = 0.36
	warmth.texture_scale = 1.8
	warmth.z_index = -10
	add_child(warmth)


func _create_player() -> void:
	player = Sprite2D.new()
	player.texture = _character_frame()
	player.position = player_position
	player.scale = Vector2(0.19, 0.19)
	player.z_index = 10
	add_child(player)


func _character_frame() -> AtlasTexture:
	var atlas := AtlasTexture.new()
	atlas.atlas = CHARACTER_TEXTURE
	atlas.region = Rect2(facing * 256, active_character * 512, 256, 512)
	return atlas


func _create_plots() -> void:
	# These sit over the detailed foreground field in the original world art.
	var starts := [
		Vector2(205, 455),
		Vector2(425, 455),
		Vector2(210, 555),
		Vector2(430, 555),
	]
	for start in starts:
		for row in range(2):
			for col in range(4):
				plots.append({
					"position": start + Vector2(col * 44, row * 36),
					"state": PlotState.WILD,
					"growth": 0,
					"watered": false,
				})


func _create_pollen() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 9407
	for i in range(28):
		pollen.append({
			"position": Vector2(rng.randf_range(30, 1120), rng.randf_range(80, 590)),
			"speed": rng.randf_range(3.0, 10.0),
			"phase": rng.randf_range(0.0, TAU),
			"size": rng.randf_range(0.8, 2.0),
		})


func _process(delta: float) -> void:
	if help_open:
		message_time = maxf(0.0, message_time - delta)
		queue_redraw()
		return

	# Read physical keys directly. Browser exports do not always populate
	# Godot's built-in ui_* actions, while physical key polling is consistent.
	var direction := Vector2(
		float(Input.is_physical_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT))
			- float(Input.is_physical_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT)),
		float(Input.is_physical_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN))
			- float(Input.is_physical_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP)),
	)
	if direction.length() > 0.05:
		is_moving = true
		walk_time += delta * 10.0
		_set_facing(direction)
		var next := player_position + direction.normalized() * 142.0 * delta
		if _can_walk(next):
			player_position = next
		player.position = player_position + Vector2(0, sin(walk_time) * 1.8)
	else:
		is_moving = false
		player.position = player_position

	hour += delta * 0.018
	if hour >= 22.0:
		_sleep()

	for mote in pollen:
		mote.position.x += mote.speed * delta
		mote.position.y += sin(Time.get_ticks_msec() * 0.001 + mote.phase) * delta * 2.0
		if mote.position.x > 1160:
			mote.position.x = -5

	if message_time > 0:
		message_time -= delta
	queue_redraw()


func _set_facing(direction: Vector2) -> void:
	var next_facing := facing
	if absf(direction.x) > absf(direction.y):
		next_facing = 3 if direction.x > 0 else 2
	else:
		next_facing = 0 if direction.y > 0 else 1
	if next_facing != facing:
		facing = next_facing
		player.texture = _character_frame()


func _can_walk(point: Vector2) -> bool:
	if not Rect2(48, 62, 1056, 535).has_point(point):
		return false
	# Farmhouse, cliffs, pond, and market stall.
	var obstacles := [
		Rect2(30, 62, 310, 155),
		Rect2(686, 102, 405, 345),
		Rect2(390, 285, 132, 105),
		Rect2(0, 0, 1152, 52),
	]
	for obstacle in obstacles:
		if obstacle.grow(-12).has_point(point):
			return false
	return true


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_1:
				_select_tool(Tool.HOE)
			KEY_2:
				_select_tool(Tool.SEEDS)
			KEY_3:
				_select_tool(Tool.WATER)
			KEY_4:
				_select_tool(Tool.HAND)
			KEY_Q:
				active_character = 1 - active_character
				player.texture = _character_frame()
				_show_message("Now playing as %s." % character_names[active_character])
				_save_game()
			KEY_SPACE:
				_use_tool()
			KEY_E:
				_interact()
			KEY_SLASH:
				help_open = not help_open
			KEY_ESCAPE:
				help_open = false
			KEY_N:
				_sleep()
		queue_redraw()


func _select_tool(tool: Tool) -> void:
	selected_tool = tool
	_show_message("%s selected." % tool_names[selected_tool])


func _nearest_plot(max_distance := 72.0) -> int:
	var best := -1
	var best_distance := max_distance
	for i in range(plots.size()):
		var distance: float = player_position.distance_to(plots[i].position)
		if distance < best_distance:
			best_distance = distance
			best = i
	return best


func _use_tool() -> void:
	var index := _nearest_plot()
	if index < 0:
		_show_message("Move closer to a field plot.")
		return

	var plot := plots[index]
	match selected_tool:
		Tool.HOE:
			if plot.state == PlotState.WILD:
				plot.state = PlotState.TILLED
				_show_message("Rich valley soil, ready for seed.")
			else:
				_show_message("That patch is already prepared.")
		Tool.SEEDS:
			if seeds <= 0:
				_show_message("Out of seeds — visit the striped market stall.")
			elif plot.state == PlotState.TILLED:
				plot.state = PlotState.PLANTED
				plot.growth = 0
				plot.watered = false
				seeds -= 1
				_show_message("A moonberry seed settles into the soil.")
			else:
				_show_message("Till an empty patch first.")
		Tool.WATER:
			if plot.state == PlotState.PLANTED and not plot.watered:
				plot.watered = true
				_show_message("Water catches the morning light.")
			else:
				_show_message("Nothing here needs water.")
		Tool.HAND:
			if plot.state == PlotState.READY:
				plot.state = PlotState.TILLED
				plot.growth = 0
				plot.watered = false
				harvested += 1
				coins += 18
				_show_message("Moonberries harvested · +18g")
			else:
				_show_message("This crop isn't ready yet.")
	plots[index] = plot
	_save_game()
	queue_redraw()


func _interact() -> void:
	# Market stall.
	if player_position.distance_to(Vector2(455, 340)) < 120:
		if coins >= 12:
			coins -= 12
			seeds += 5
			_show_message("Vallie's seed bundle · 5 seeds for 12g")
			_save_game()
		else:
			_show_message("Vallie: Come back when you've sold a harvest.")
		return
	# Farmhouse front door.
	if player_position.distance_to(Vector2(285, 214)) < 105:
		_sleep()
		return
	# Pond bridge.
	if player_position.distance_to(Vector2(700, 255)) < 100:
		_show_message("Callie: The pond glows silver after dusk.")
		return
	_show_message("Wildflowers, cedar smoke, and running water.")


func _sleep() -> void:
	day += 1
	hour = 6.5
	for i in range(plots.size()):
		var plot := plots[i]
		if plot.state == PlotState.PLANTED:
			if plot.watered:
				plot.growth += 1
			plot.watered = false
			if plot.growth >= 3:
				plot.state = PlotState.READY
		plots[i] = plot
	player_position = Vector2(350, 260)
	player.position = player_position
	_show_message("Day %d · The valley wakes in gold." % day)
	_save_game()


func _save_game() -> void:
	var save := ConfigFile.new()
	save.set_value("farm", "day", day)
	save.set_value("farm", "hour", hour)
	save.set_value("farm", "coins", coins)
	save.set_value("farm", "seeds", seeds)
	save.set_value("farm", "harvested", harvested)
	save.set_value("player", "character", active_character)
	save.set_value("player", "position", player_position)
	var states: Array[int] = []
	var growth: Array[int] = []
	var watered: Array[bool] = []
	for plot in plots:
		states.append(plot.state)
		growth.append(plot.growth)
		watered.append(plot.watered)
	save.set_value("plots", "states", states)
	save.set_value("plots", "growth", growth)
	save.set_value("plots", "watered", watered)
	save.save(SAVE_PATH)


func _load_game() -> void:
	var save := ConfigFile.new()
	if save.load(SAVE_PATH) != OK:
		return
	day = save.get_value("farm", "day", 1)
	hour = save.get_value("farm", "hour", 7.25)
	coins = save.get_value("farm", "coins", 50)
	seeds = save.get_value("farm", "seeds", 8)
	harvested = save.get_value("farm", "harvested", 0)
	active_character = save.get_value("player", "character", 0)
	player_position = save.get_value("player", "position", Vector2(555, 340))
	var states: Array = save.get_value("plots", "states", [])
	var growth: Array = save.get_value("plots", "growth", [])
	var watered: Array = save.get_value("plots", "watered", [])
	for i in range(mini(plots.size(), states.size())):
		plots[i].state = states[i]
		plots[i].growth = growth[i] if i < growth.size() else 0
		plots[i].watered = watered[i] if i < watered.size() else false


func _show_message(text: String) -> void:
	message = text
	message_time = 4.5


func _draw() -> void:
	_draw_world_fx()
	_draw_plots()
	_draw_player_shadow()
	_draw_hud()
	if help_open:
		_draw_help()


func _draw_world_fx() -> void:
	var light := clampf(1.0 - absf(hour - 13.0) / 11.0, 0.12, 1.0)
	if hour > 18.0:
		var alpha := clampf((hour - 18.0) / 4.0, 0.0, 0.58)
		draw_rect(Rect2(Vector2.ZERO, VIEW), Color(0.05, 0.08, 0.2, alpha))
		draw_circle(Vector2(962, 82), 24, Color(0.92, 0.94, 0.78, alpha))
	elif hour < 8.0:
		var alpha := clampf((8.0 - hour) / 2.0, 0.0, 0.23)
		draw_rect(Rect2(Vector2.ZERO, VIEW), Color(0.98, 0.56, 0.35, alpha))

	for mote in pollen:
		var glow := Color(1.0, 0.9, 0.53, 0.24 + light * 0.18)
		draw_circle(mote.position, mote.size, glow)


func _draw_plots() -> void:
	for plot in plots:
		var pos: Vector2 = plot.position
		if plot.state == PlotState.WILD:
			draw_circle(pos, 3.0, Color(0.72, 0.84, 0.34, 0.7))
			continue
		_draw_oval(pos + Vector2(0, 8), Vector2(17, 9), Color(0.20, 0.11, 0.055, 0.52))
		draw_circle(pos, 13, Color(0.34, 0.19, 0.09, 0.72))
		if plot.watered:
			draw_arc(pos, 12, 0, TAU, 18, Color(0.33, 0.65, 0.78, 0.8), 2)
		if plot.state in [PlotState.PLANTED, PlotState.READY]:
			_draw_plant(pos, plot.growth, plot.state == PlotState.READY)


func _draw_oval(center: Vector2, radius: Vector2, color: Color) -> void:
	var points := PackedVector2Array()
	for i in range(20):
		var angle := TAU * float(i) / 20.0
		points.append(center + Vector2(cos(angle) * radius.x, sin(angle) * radius.y))
	draw_colored_polygon(points, color)


func _draw_plant(pos: Vector2, growth: int, ready: bool) -> void:
	var height := 7.0 + growth * 5.0
	draw_line(pos + Vector2(0, 5), pos - Vector2(0, height), Color("#315f35"), 3.0)
	draw_colored_polygon(PackedVector2Array([
		pos - Vector2(1, height * 0.55),
		pos + Vector2(-10 - growth, -height * 0.72),
		pos + Vector2(-3, -height * 0.32),
	]), Color("#5e963f"))
	draw_colored_polygon(PackedVector2Array([
		pos - Vector2(-1, height * 0.7),
		pos + Vector2(10 + growth, -height * 0.85),
		pos + Vector2(3, -height * 0.45),
	]), Color("#77ad4b"))
	if ready:
		for offset in [Vector2(-7, -height), Vector2(5, -height - 3), Vector2(0, -height + 5)]:
			draw_circle(pos + offset, 4.5, Color("#b33468"))
			draw_circle(pos + offset - Vector2(1.5, 1.5), 1.4, Color("#f29a9d"))


func _draw_player_shadow() -> void:
	_draw_oval(player_position + Vector2(0, 41), Vector2(22, 7), Color(0.08, 0.12, 0.08, 0.32))


func _draw_hud() -> void:
	var font := ThemeDB.fallback_font
	draw_style_panel(Rect2(18, 16, 390, 62), Color(0.08, 0.15, 0.12, 0.88), CREAM)
	draw_string(font, Vector2(36, 43), character_names[active_character], HORIZONTAL_ALIGNMENT_LEFT, -1, 22, ROSE if active_character == 0 else Color("#63c5c8"))
	draw_string(font, Vector2(36, 66), "Day %d  ·  %s  ·  Q switches" % [day, _clock_text()], HORIZONTAL_ALIGNMENT_LEFT, -1, 15, CREAM)
	draw_string(font, Vector2(300, 51), "%dg" % coins, HORIZONTAL_ALIGNMENT_LEFT, -1, 21, HONEY)
	draw_string(font, Vector2(350, 50), "◈ %d" % seeds, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, CREAM)

	var hotbar_width := 404.0
	var hotbar_x := (VIEW.x - hotbar_width) * 0.5
	draw_style_panel(Rect2(hotbar_x, 574, hotbar_width, 58), Color(0.08, 0.15, 0.12, 0.90), CREAM)
	for i in range(4):
		var rect := Rect2(hotbar_x + 8 + i * 98, 582, 92, 42)
		draw_rect(rect, HONEY if i == selected_tool else Color(0.17, 0.29, 0.23, 0.92), true)
		draw_string(font, rect.position + Vector2(10, 17), "%d" % (i + 1), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, INK if i == selected_tool else HONEY)
		draw_string(font, rect.position + Vector2(10, 35), tool_names[i], HORIZONTAL_ALIGNMENT_LEFT, -1, 15, INK if i == selected_tool else CREAM)

	if message_time > 0:
		var width := minf(640.0, maxf(260.0, font.get_string_size(message, HORIZONTAL_ALIGNMENT_LEFT, -1, 17).x + 48))
		var x := (VIEW.x - width) * 0.5
		draw_style_panel(Rect2(x, 516, width, 42), Color(0.07, 0.12, 0.10, 0.91), HONEY)
		draw_string(font, Vector2(x + 24, 543), message, HORIZONTAL_ALIGNMENT_CENTER, width - 48, 17, CREAM)

	var near_plot := _nearest_plot() >= 0
	if near_plot:
		draw_string(font, player_position + Vector2(-46, -68), "SPACE · %s" % tool_names[selected_tool].to_upper(), HORIZONTAL_ALIGNMENT_CENTER, 92, 12, CREAM)


func draw_style_panel(rect: Rect2, color: Color, border: Color) -> void:
	draw_rect(rect, Color(0, 0, 0, 0.28), true)
	draw_rect(rect.grow(-3), color, true)
	draw_line(rect.position + Vector2(10, 3), rect.position + Vector2(rect.size.x - 10, 3), Color(border, 0.42), 1.0)


func _draw_help() -> void:
	var font := ThemeDB.fallback_font
	draw_rect(Rect2(Vector2.ZERO, VIEW), Color(0.02, 0.05, 0.04, 0.88), true)
	draw_style_panel(Rect2(226, 92, 700, 458), Color(0.09, 0.18, 0.14, 0.98), HONEY)
	draw_string(font, Vector2(276, 142), "CALLIE & VALLIE", HORIZONTAL_ALIGNMENT_LEFT, -1, 32, HONEY)
	draw_string(font, Vector2(276, 173), "A farm that wakes up with you", HORIZONTAL_ALIGNMENT_LEFT, -1, 17, CREAM)
	var controls := [
		["WASD / arrows", "Walk the valley"],
		["1 · 2 · 3 · 4", "Hoe · seeds · water · harvest"],
		["Space", "Use selected tool near a field plot"],
		["E", "Talk, shop, sleep, or inspect"],
		["Q", "Switch between Callie and Vallie"],
		["N", "Sleep and grow watered crops"],
		["? / Escape", "Close this guide"],
	]
	var y := 220.0
	for control in controls:
		draw_string(font, Vector2(278, y), control[0], HORIZONTAL_ALIGNMENT_LEFT, 190, 16, Color("#7dd4cf"))
		draw_string(font, Vector2(478, y), control[1], HORIZONTAL_ALIGNMENT_LEFT, 380, 16, CREAM)
		y += 40
	draw_string(font, Vector2(276, 516), "Progress saves automatically in this browser.", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(CREAM, 0.68))


func _clock_text() -> String:
	var h := int(hour)
	var m := int((hour - h) * 60.0)
	var suffix := "AM" if h < 12 else "PM"
	var display_h := h % 12
	if display_h == 0:
		display_h = 12
	return "%d:%02d %s" % [display_h, m, suffix]

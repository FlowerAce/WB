const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;

const Main = imports.ui.main;

class Extension {
	constructor(extensionMeta) {
		this.extensionPath = extensionMeta.path;
		this.windowTracker = null;
		this.overviewTracker = [];
	}

	windowChanged() {
		const window = this.getWindow();
		if (Main.overview.visible || !window) {
			this.rightActor.hide();
			return;
		}
		this.rightActor.show();
	}

	overviewChanged() {
		if (Main.overview.visible) {
			this.rightActor.hide();
			return;
		}
		if (this.getWindow()) {
			this.rightActor.show();
		}
	}

	connectSignal() {
		this.windowTracker = Shell.WindowTracker.get_default().connect(
			"notify::focus-app",
			this.windowChanged.bind(this)
		);
		this.overviewTracker.push(
			Main.overview.connect("showing", this.overviewChanged.bind(this)),
			Main.overview.connect("hidden", this.overviewChanged.bind(this))
		);
	}

	disconnectSignals() {
		Shell.WindowTracker.get_default().disconnect(this.windowTracker);
		this.overviewTracker.forEach((tracker) => {
			Main.overview.disconnect(tracker);
		});
	}

	loadTheme() {
		const cssPath = GLib.build_filenamev([
			this.extensionPath,
			"resources",
			"style.css",
		]);

		const themeContext = St.ThemeContext.get_for_stage(global.stage);
		const currentTheme = themeContext.get_theme();

		currentTheme.load_stylesheet(Gio.file_new_for_path(cssPath));

		this.rightActor.grab_key_focus();

		this.theme_path = cssPath;
	}

	display(order) {
		for (let i = 0; i < order.length; i++) {
			const buttonName = order[i];
			const button = new St.Button({
				style_class: `${buttonName} window-button`,
				track_hover: true,
			});
			button.connect("button-press-event", this[buttonName].bind(this));
			this.rightBox.add(button);
		}
	}

	checkWindowType(window) {
		const types = [
			Meta.WindowType.NORMAL,
			Meta.WindowType.DIALOG,
			Meta.WindowType.MODAL_DIALOG,
			Meta.WindowType.POPUP_MENU,
		];
		const windowType = window.get_window_type();
		return types.some((type) => type === windowType);
	}

	getWindow() {
		const win = global.display.get_focus_window();
		const check =
			global.workspace_manager.get_active_workspace() ===
			win?.get_workspace();
		if (win && check && this.checkWindowType(win)) {
			return win;
		}
	}

	minimize() {
		const win = this.getWindow();
		if (!win) {
			return;
		}

		win.minimize();
	}

	maximize() {
		const win = this.getWindow();
		if (!win) {
			return;
		}

		const maximized =
			Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL;

		if (win.get_maximized() == maximized) {
			win.unmaximize(maximized);
		} else {
			win.maximize(maximized);
		}
		win.activate(global.get_current_time());
	}

	close() {
		const win = this.getWindow();
		if (!win) {
			return;
		}

		win.delete(global.get_current_time());
	}

	enable() {
		this.rightActor = new St.Bin({ style_class: "box-bin" });
		this.rightBox = new St.BoxLayout({ style_class: "button-box" });

		this.rightActor.add_actor(this.rightBox);

		this.display(["minimize", "close"]);

		this.loadTheme();

		this.windowTracker = null;
		this.overviewTracker = [];
		this.connectSignal();

		const rightContiner = Main.panel._rightBox;
		const rightpos = -1;

		rightContiner.insert_child_at_index(this.rightActor, rightpos);

		this.windowChanged();
	}

	disable() {
		this.rightActor.destroy();

		this.disconnectSignals();
	}
}

function init(extensionMeta) {
	return new Extension(extensionMeta);
}

import { showError, formatTimeLabel } from "./utils.js";
import { loadSortedTrackData } from "./dataLoader.js";
import { setupController } from "./controller.js";
import { createMapGraph } from "./mapGraph.js";
import { createElevationGraph } from "./elevationGraph.js";
import { createVideoModule } from "./videoModule.js";
import { registerZKeyToggle } from "./keyboardShortcuts.js";

// ===============================

async function init() {
	try {
		const { coords, elevations, tsDates } = await loadSortedTrackData();
		setupController(coords, elevations, tsDates, {
			formatTimeLabel,
			createMapGraph,
			createElevationGraph,
			createVideoModule,
			registerZKeyToggle,
		});
	} catch (err) {
		console.error(err);
		showError(err.message || String(err));
	}
}
window.addEventListener("load", init);

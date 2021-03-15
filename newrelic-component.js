sap.ui.define([
	"sap/ui/core/Component"
], function (Component) {


	return Component.extend("com.plm.appnewrelicpocplugin.Component", {

		metadata: {
			"manifest": "json"
		},

		init: function () {
			if (window.newrelic.info || newrelic.info) {
				console.log('New Relic component loaded!');
			} else {
				console.log('New Relic component did not load correctly')
			}
			addUserDetailsToNewRelic();
		},
		addUserDetailsToNewRelic: async function () {
			const oUserInfo = await this.getUserInfoService();
			console.log(oUserInfo);
			const sUserId = oUserInfo.getId();
			if(newrelic) {
				console.log('[New Relic]: Setting the current logged in user');
				newrelic.setCustomAttribute('user', sUserId);
			}
		},
		getUserInfoService: async function () {
			return new Promise(resolve => sap.ui.require([
				"sap/ushell/library"
			], oSapUshellLib => {
				const oContainer = oSapUshellLib.Container;
				const pService = oContainer.getServiceAsync("UserInfo"); // getServiceAsync available since 1.55
				resolve(pService);
			}));
		},

		/**
		 * Returns the shell renderer instance in a reliable way,
		 * i.e. independent from the initialization time of the plug-in.
		 * This means that the current renderer is returned immediately, if it
		 * is already created (plug-in is loaded after renderer creation) or it
		 * listens to the &quot;rendererCreated&quot; event (plug-in is loaded
		 * before the renderer is created).
		 *
		 *  @returns {object}
		 *      a jQuery promise, resolved with the renderer instance, or
		 *      rejected with an error message.
		 */

	});
});
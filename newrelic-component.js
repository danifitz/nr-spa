sap.ui.define([
    "sap/ui/core/Component"
], function (Component) {

    /*
     * Attributes we set in this component
     * hashFragment - the portion of the URL after the # i.e. #Shell-home
     * pageTitle - the title of the HTML document
     * environment - dev, qa, prod etc.
     * userId [optional]
     * userEmail [optional]
     * userFullname [optional] - user details, only if they have consented to tracking
     * appIntent - the app intent as reported by SAP
     * appFrameworkId - SAP framework ID 
     * appId - the app ID as reported by SAP FLP
     * appVersion - the version of the SAP app being loaded
     * appFrameworkVersion - the version of the app framework as reported by SAP
     */
    return Component.extend("com.plm.appnewrelicpocplugin.Component", {

        metadata: {
            "manifest": "json"
        },

        init: function () {
            if (window.newrelic.info || newrelic.info) {
                console.log('New Relic component loaded!');

                // check user tracking preferences
                let consent = getUserTrackingPreferences();
                console.log('[New Relic] user has consented to tracking:', consent);

                // listen for hash change events and set the custom attribute in NR
                window.onhashchange = function () {
					let fioriAppName = this.getFlpAppName();
                    newrelic.setCustomAttribute('fioriApp', fioriAppName);
				};

                //TODO: only capture details if the user has consented to tracking.
                
                // add the user details 
                addUserDetailsToNewRelic();

                // listen for the app lifecycle events
                getAppLifecycle();
            } else {
                console.log('New Relic component did not load correctly')
            }
        },
        addUserDetailsToNewRelic: async function () {
            const oUserInfo = await this.getUshellServiceAsync("UserInfo");
            if (newrelic) {
                console.log('[New Relic]: Setting the current logged in user');
                newrelic.setCustomAttribute('userId', oUserInfo.getId());
                newrelic.setCustomAttribute('userEmail', oUserInfo.getEmail());
                newrelic.setCustomAttribute('userFullName', oUserInfo.getFullName());
            }
        },
        // Check if the user has said yes to tracking
        // https://sapui5.hana.ondemand.com/#/api/sap.ushell.services.UsageAnalytics
        getUserTrackingPreferences: async function () {
            const userTrackingPreferences = await this.getUshellServiceAsync("UsageAnalytics");
            return userTrackingPreferences.userEnabled;
        },
        getAppLifecycle: async function () {
            const appLifeCycleService = await this.getUshellServiceAsync("AppLifeCycle");
            appLifeCycleService.attachAppLoaded(function (oEvent) {
                let oParameters = oEvent.getParameters();
                
                // we don't care if the user just landed on the home page i.e. FLP shell
                if (oParameters.homePage != true) {
                    // get some key information about the app that just loaded to store as custom attributes in New Relic
                    // https://sapui5.hana.ondemand.com/#/api/sap.ushell.services.AppLifeCycle%23methods/attachAppLoaded
                    appLifeCycleService.getCurrentApplication.getInfo(['appIntent', 'appFrameworkId', 'appId', 'appVersion', 'appFrameworkVersion']).then(function (params) {
                        for (const [key, value] of Object.entries(params)) {
                            console.log('[New Relic]: Setting custom attributes from app loaded event:', `${key}: ${value}`);
                            newrelic.setCustomAttribute(key, value);
                        }
                    })
                }
                console.log('[New Relic] - app loaded event fired with parameters: ', oParameters)
            }.bind(this));
        },
        // Get the value after the URL hash to determine which app is active
		getFlpAppName: function() {
			let subSite = "";

			if (window.location.href.substring(window.location.href.indexOf("#")) !== -1) {
				subSite = window.location.href.substring(window.location.href.indexOf("#") + 1);
			}
			if (subSite.indexOf("&") !== -1) {
				subSite = subSite.substring(0, subSite.indexOf("&"));
			}

			return (subSite !== "") ? subSite : undefined;
		},
        // serviceName - the name of the service you want from the Ushell Library
        // https://sapui5.hana.ondemand.com/#/api/sap.ushell.services
        getUshellServiceAsync: async function (serviceName) {
            return new Promise(resolve => sap.ui.require([
                "sap/ushell/library"
            ], oSapUshellLib => {
                const oContainer = oSapUshellLib.Container;
                const pService = oContainer.getServiceAsync(serviceName); // getServiceAsync available since 1.55
                resolve(pService);
            }));
        }
    });
});
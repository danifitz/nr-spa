sap.ui.define([
    "sap/ui/core/Component"
], function (Component) {

    /*
     * Attributes we set in this component
     * hashFragment - the portion of the URL after the # i.e. #Shell-home
     * pageTitle - the title of the HTML document
     * environment - dev, qa, prod etc.
     * userId [optional] - only if user consents to tracking
     * userEmail [optional] - NOT COMPATIBLE WITH SAP VERSION
     * userFullname [optional] - NOT COMPATIBLE WITH SAP VERSION
     * appIntent - the app intent as reported by SAP
     * appFrameworkId - SAP framework ID 
     * appId - the app ID as reported by SAP FLP
     * appVersion - the version of the SAP app being loaded
     * appFrameworkVersion - the version of the app framework as reported by SAP
     */
    return Component.extend("com.plm.appnewrelicpocplugin.Component", {


        // 1.60.13 - SAP UI5 version

        metadata: {
            "manifest": "json"
        },
        /*
         * Here's where we do some important stuff to do with New Relic to enhance
         * the data that is reported by the Browser agent.
         *
         * Docs: https://docs.newrelic.com/docs/browser/new-relic-browser/browser-agent-spa-api/
         */
        init: function () {
            if (window.newrelic.info || newrelic.info) {
                console.log('New Relic component loaded!');

                // check user tracking preferences
                this.getUserTrackingPreferences().then(consent => {
                    console.log('[New Relic] user has consented to tracking:', consent);
                }).catch(error => {
                    console.log('[New Relic] user tracking preferences: error', error);
                });

                // Set which environment this is i.e. dev/prod
                newrelic.setCustomAttribute('environment', this.getEnvironment());

                // add the SAP UI Version as a custom attribute
                newrelic.setCustomAttribute('sapUiVersion', sap.ui.version);

                //TODO: only capture details if the user has consented to tracking.

                // add the user details 
                this.addUserDetailsToNewRelic();

                // listen for the app lifecycle events
                this.getAppLifecycle();
            } else {
                console.log('New Relic component did not load correctly')
            }
        },
        /*
         * Determine the current PLM environment using the URL
         *   plm-dev.unilever.com - Development
         *   plm-qa.unilever.com - QA
         *   plm-regr.unilever.com - Regression
         *   plm-sbx.unilever.com - Sandbox
         *   plm.unilever.com - Production
         */
        getEnvironment: function () {
            // get the current URL from the browser
            let currentUrl = new URL(window.location.href);
            const environments = ['dev', 'qa', 'regr', 'sbx'];

            // assume environment is production unless the URL tells us otherwise.
            let currentEnvironment = 'production';
            for (let env in environments) {
                if (currentUrl.host.indexOf(environments[env]) !== -1) {
                    currentEnvironment = environments[env];
                }
            }
            console.log('[New Relic] determined the current environment is:', currentEnvironment);
            return currentEnvironment;
        },
        /*
         * Adds details about the current logged in user as custom attributes to New Relic
         */
        addUserDetailsToNewRelic: async function () {
            const oUserInfo = await this.getUshellServiceAsync("UserInfo");
            if (newrelic) {
                console.log('[New Relic]: Setting the current logged in user');
                newrelic.setCustomAttribute('userId', oUserInfo.getId());
                // newrelic.setCustomAttribute('userEmail', oUserInfo.getEmail()); - supported since v1.86.0
                // newrelic.setCustomAttribute('userFullName', oUserInfo.getFullName()); - supported since v1.86.0
            }
        },
        /* 
         * Check if the user has said yes to tracking. We can use this to allow for opt-out for users.
         * https://sapui5.hana.ondemand.com/#/api/sap.ushell.services.UsageAnalytics
         */
        getUserTrackingPreferences: async function () {
            const userTrackingPreferences = await this.getUshellServiceAsync("UsageAnalytics");
            return userTrackingPreferences.userEnabled();
        },
        /*
         * Uses the AppLifeCycle service to listen for apps being loaded in the FLP.
         * When we detect an app being loaded, gather some information about it and
         * store that as custom attributes in New Relic.
         */
        getAppLifecycle: function () {
            // const appLifeCycleService = await this.getUshellServiceAsync("AppLifeCycle");
            var appLifeCycleService = sap.ushell.Container.getService("AppLifeCycle");
            console.log('[New Relic] got AppLifeCycleService', appLifeCycleService);

            appLifeCycleService.attachAppLoaded(function (oEvent) {
                console.log('[New Relic] attachAppLoaded event fired!');
                let oParameters = oEvent.getParameters();

                // get some key information about the app that just loaded to store as custom attributes in New Relic
                // https://sapui5.hana.ondemand.com/#/api/sap.ushell.services.AppLifeCycle%23methods/attachAppLoaded
                let currentApp = appLifeCycleService.getCurrentApplication();

                currentApp.getIntent().then(intent => {

                    // Check if there are any params we need to parse
                    if (Object.keys(intent.params).length !== 0) {
                        //loop through all the properties in the params object
                        for (const [key, param] of Object.entries(intent.params)) {
                            console.log('[New Relic] getAppLifeCycle - checking for params in intent');
                            //if we've dealing with an array
                            if (Array.isArray(param)) {
                                console.log('[New Relic] getAppLifeCycle - checking if params are an array of args')
                                for (let i = 0; i < param.length; i++) {
                                    newrelic.setCustomAttribute('intentParam' + key, param[i]);
                                    console.log('[New Relic] getAppLifeCycle - setting intent params', 'intentParam' + key, param[i]);
                                }
                            } else {
                                console.log('[New Relic] getAppLifeCycle - found param but it wasn\'t an array! it was a', typeof param);
                            }
                        }
                    }
                    console.log('[New Relic] Got information about the currently running app:', intent.semanticObject);
                    // create a page action in New Relic to indicate an app is being loaded.
                    newrelic.addPageAction('loadApp', intent);
                    newrelic.setCustomAttribute('semanticObject', intent.semanticObject);
                    newrelic.setCustomAttribute('plmAppName', intent.semanticObject);
                    newrelic.setCustomAttribute('action', intent.action);
                    newrelic.setCustomAttribute('appSpecificRoute', intent.appSpecificRoute);
                });

                currentApp.getInfo(['productName', 'languageTag', 'appIntent', 'appFrameworkId', 'appId', 'appVersion', 'appFrameworkVersion']).then(function (params) {
                    for (const [key, value] of Object.entries(params)) {
                        console.log('[New Relic]: Setting custom attributes from app loaded event:', `${'plm' + key.trim().replace(/^\w/, (c) => c.toUpperCase())}: ${value}`);
                        newrelic.setCustomAttribute('plm' + key.trim().replace(/^\w/, (c) => c.toUpperCase()), value);
                    }
                });

                // we don't care if the user just landed on the home page i.e. FLP shell
                // if (oParameters.homePage != true) {

                // }

                console.log('[New Relic] - app loaded event fired with parameters: ', oParameters);
            });
        },
        /* 
         * Gets an instance of a service from the SAP UShell
         *      serviceName - the name of the service you want from the Ushell Library
         * https://sapui5.hana.ondemand.com/#/api/sap.ushell.services
         */
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
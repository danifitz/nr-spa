sap.ui.define([
    "sap/ui/core/Component"
], function (Component) {

    /**
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
        /**
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

                // capture which app is running when this component first loads
                this.captureAppDetails();

                // add event listener to hash changes
                window.addEventListener('hashchange', () => {
                    this.captureAppDetails();
                });
            } else {
                console.log('New Relic component did not load correctly')
            }
        },
        /**
         * Determine the current PLM environment using the URL
         *   plm-dev.unilever.com - Development
         *   plm-qa.unilever.com - QA
         *   plm-perf.unilever.com - Performance
         *   plm-regr.unilever.com - Regression
         *   plm-sbx.unilever.com - Sandbox
         *   plm.unilever.com - Production
         */
        getEnvironment: function () {
            // get the current URL from the browser
            let currentUrl = new URL(window.location.href);

            // this list of K:V pairs maps shortened names in the PLM URL i.e. plm-dev to their proper name i.e. Development
            const environmentList = {'dev': 'Development', 'qa': 'Quality Assurance', 'perf': 'Performance', 'regr': 'Regression', 'sbx': 'Sandbox'}

            // assume environment is production unless the URL tells us otherwise.
            let currentEnvironment = 'Production';
            for (const [key, value] of Object.entries(environmentList)) {
                if (currentUrl.host.indexOf(key) !== -1) {
                    currentEnvironment = value;
                }
            }

            console.log('[New Relic] getEnvironment - determined the current environment is:', currentEnvironment);
            return currentEnvironment;
        },
        /**
         * Adds details about the current logged in user as custom attributes to New Relic
         */
        addUserDetailsToNewRelic: async function () {
            // const oUserInfo = await this.getUshellServiceAsync("UserInfo");
            const userInfoService = sap.ushell.Container.getService("UserInfo").getUser();
            if (newrelic) {
                console.log('[New Relic]: Setting the current logged in user');
                try {
                    newrelic.setCustomAttribute('userId', userInfoService.getId());
                    newrelic.setCustomAttribute('userEmail', userInfoService.getEmail());
                    newrelic.setCustomAttribute('userFullName', userInfoService.getFullName());
                } catch(error) {
                    console.error('[New Relic] addUserDetailsToNewRelic, got error fetching email, fullname', error);
                }
                // if (this.versionCompare(sap.ui.version,'1.86.0') === 1) {
                    
                // }
            }
        },
        /**  
         * Check if the user has said yes to tracking. We can use this to allow for opt-out for users.
         * https://sapui5.hana.ondemand.com/#/api/sap.ushell.services.UsageAnalytics
         */
        getUserTrackingPreferences: async function () {
            const userTrackingPreferences = await this.getUshellServiceAsync("UsageAnalytics");
            return userTrackingPreferences.userEnabled();
        },
        captureAppDetails: function () {
            let intent = this.getIntent();

            console.log('[New Relic] - captureAppDetails - got intent:', intent);

            // Set NR attributes
            newrelic.setCustomAttribute('semanticObject', intent.semanticObject);
            newrelic.setCustomAttribute('plmAppName', intent.semanticObject);
            newrelic.setCustomAttribute('action', intent.action);
            newrelic.setCustomAttribute('pageTitle', document.title);
            // app specific route is sometimes undefined, so check before trying to set attribute
            if (typeof intent.appSpecificRoute !== 'undefined') {
                newrelic.setCustomAttribute('appSpecificRoute', intent.appSpecificRoute);
            }
        },
        /** 
         * Uses the AppLifeCycle service to listen for apps being loaded in the FLP.
         * When we detect an app being loaded, gather some information about it and
         * store that as custom attributes in New Relic.
         */
        getAppLifecycle: function () {
            var appLifeCycleService = sap.ushell.Container.getService("AppLifeCycle");
            console.log('[New Relic] got AppLifeCycleService', appLifeCycleService);

            appLifeCycleService.attachAppLoaded(function (oEvent) {
                // create a page action in New Relic to indicate an app has being loaded.
                newrelic.addPageAction('loadApp', this.getIntent());
                console.log('[New Relic] getAppLifeCycle - added Page Action: loadApp');

                if (this.versionCompare(sap.ui.version, '1.80.0') === 1) {
                    // Only available in sap.ui.version > 1.80.0
                    appLifeCycleService.getCurrentApplication().getInfo(['productName', 'languageTag', 'appIntent', 'appFrameworkId', 'appId', 'appVersion', 'appFrameworkVersion']).then(function (params) {
                        for (const [key, value] of Object.entries(params)) {
                            console.log('[New Relic]: Setting custom attributes from app loaded event:', `${'plm' + key.trim().replace(/^\w/, (c) => c.toUpperCase())}: ${value}`);
                            newrelic.setCustomAttribute('plm' + key.trim().replace(/^\w/, (c) => c.toUpperCase()), value);
                        }
                    });
                } 
            });
        },
        getIntent: function () {
            let currentUrl = window.location.href;
            let urlParsingService = sap.ushell.Container.getService('URLParsing');
            let shellHash = urlParsingService.getShellHash(currentUrl);
            let intent = urlParsingService.parseShellHash(shellHash);
            return intent;
        },
        /** 
         * Gets an instance of a service from the SAP UShell
         * 
         * https://sapui5.hana.ondemand.com/#/api/sap.ushell.services
         *
         * @param {string} serviceName - the name of the service you want from the Ushell Library
         * 
         */
        getUshellServiceAsync: async function (serviceName) {
            return new Promise(resolve => sap.ui.require([
                "sap/ushell/library"
            ], oSapUshellLib => {
                const oContainer = oSapUshellLib.Container;
                const pService = oContainer.getServiceAsync(serviceName); // getServiceAsync available since 1.55
                resolve(pService);
            }));
        },
        /**
         * Compares two software version numbers (e.g. "1.7.1" or "1.2b").
         *
         * This function was born in http://stackoverflow.com/a/6832721.
         *
         * @param {string} v1 The first version to be compared.
         * @param {string} v2 The second version to be compared.
         * @param {object} [options] Optional flags that affect comparison behavior:
         * <ul>
         *     <li>
         *         <tt>lexicographical: true</tt> compares each part of the version strings lexicographically instead of
         *         naturally; this allows suffixes such as "b" or "dev" but will cause "1.10" to be considered smaller than
         *         "1.2".
         *     </li>
         *     <li>
         *         <tt>zeroExtend: true</tt> changes the result if one version string has less parts than the other. In
         *         this case the shorter string will be padded with "zero" parts instead of being considered smaller.
         *     </li>
         * </ul>
         * @returns {number|NaN}
         * <ul>
         *    <li>0 if the versions are equal</li>
         *    <li>a negative integer iff v1 < v2</li>
         *    <li>a positive integer iff v1 > v2</li>
         *    <li>NaN if either version string is in the wrong format</li>
         * </ul>
         *
         */
        versionCompare: function (v1, v2, options) {
            var lexicographical = options && options.lexicographical,
                zeroExtend = options && options.zeroExtend,
                v1parts = v1.split('.'),
                v2parts = v2.split('.');

            function isValidPart(x) {
                return (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x);
            }

            if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
                return NaN;
            }

            if (zeroExtend) {
                while (v1parts.length < v2parts.length) v1parts.push("0");
                while (v2parts.length < v1parts.length) v2parts.push("0");
            }

            if (!lexicographical) {
                v1parts = v1parts.map(Number);
                v2parts = v2parts.map(Number);
            }

            for (var i = 0; i < v1parts.length; ++i) {
                if (v2parts.length == i) {
                    return 1;
                }

                if (v1parts[i] == v2parts[i]) {
                    continue;
                }
                else if (v1parts[i] > v2parts[i]) {
                    return 1;
                }
                else {
                    return -1;
                }
            }

            if (v1parts.length != v2parts.length) {
                return -1;
            }

            return 0;
        }
    });
});
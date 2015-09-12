/*
 * Copyright (c) 2015
 *
 * This file is licensed under the Affero General Public License version 3
 * or later.
 *
 * See the COPYING-README file.
 *
 */

(function() {
	if(!OC.Share) {
		OC.Share = {};
		OC.Share.Types = {};
	}

	/**
	 * @typedef {object} OC.Share.Types.LinkShareInfo
	 * @property {bool} isLinkShare
	 * @property {string} token
	 * @property {string|null} password
	 * @property {string} link
	 * @property {Date} expiration
	 * @property {number} stime share time
	 */

	/**
	 * @typedef {object} OC.Share.Types.Collection
	 * @property {string} item_type
	 * @property {string} path
	 * @property {string} item_source TODO: verify
	 */

	/**
	 * @typedef {object} OC.Share.Types.Reshare
	 * @property {string} uid_owner
	 * @property {number} share_type
	 * @property {string} share_with
	 * @property {string} displayname_owner
	 * @property {number} permissions
	 */

	/**
	 * @typedef {object} OC.Share.Types.ShareInfo
	 * @property {number} share_type
	 * @property {number} permissions
	 * @property {number} file_source optional
	 * @property {number} item_source
	 * @property {string} token
	 * @property {string} share_with
	 * @property {string} share_with_displayname
	 * @property {string} share_mail_send
	 * @property {OC.Share.Types.Collection|undefined} collection
	 * @property {Date} expiration optional?
	 * @property {number} stime optional?
	 */

	/**
	 * @typedef {object} OC.Share.Types.ShareItemInfo
	 * @property {OC.Share.Types.Reshare} reshare
	 * @property {OC.Share.Types.ShareInfo[]} shares
	 * @property {OC.Share.Types.LinkShareInfo|undefined} linkShare
	 */

	/**
	 * @class OCA.Share.ShareItemModel
	 * @classdesc
	 *
	 * Represents the GUI of the share dialogue
	 *
	 * // FIXME: use OC Share API once #17143 is done
	 */
	var ShareItemModel = OC.Backbone.Model.extend({
		initialize: function(attributes, options) {
			if(!_.isUndefined(options.configModel)) {
				this.configModel = options.configModel;
			}
			if(!_.isUndefined(options.fileInfoModel)) {
				/** @type {OC.Files.FileInfo} **/
				this.fileInfoModel = options.fileInfoModel;
			}

			_.bindAll(this, 'addShare');
		},

		defaults: {
			allowPublicUploadStatus: false,
			permissions: 0,
			linkShare: {}
		},

		addLinkShare: function() {
			var model = this;
			var expiration = this.configModel.getDefaultExpirationDateString();
			var itemType = this.get('itemType');
			var itemSource = this.get('itemSource');
			OC.Share.share(itemType, itemSource, OC.Share.SHARE_TYPE_LINK, '', OC.PERMISSION_READ, this.fileInfoModel.get('name'), expiration, function(data) {
				model.fetch();
				//FIXME: updateIcon belongs to view
				OC.Share.updateIcon(itemType, itemSource);
			});
		},

		removeLinkShare: function() {
			var model = this;
			var itemType = this.get('itemType');
			var itemSource = this.get('itemSource');

			OC.Share.unshare(itemType, itemSource, OC.Share.SHARE_TYPE_LINK, '', function() {
				model.fetch();
				//FIXME: updateIcon belongs to view
				OC.Share.updateIcon(itemType, itemSource);
			});
		},

		addShare: function(event, selected, options) {
			event.preventDefault();

			var shareType = selected.item.value.shareType;
			var shareWith = selected.item.value.shareWith;
			var fileName = this.fileInfoModel.get('name');
			options = options || {};

			// Default permissions are Edit (CRUD) and Share
			// Check if these permissions are possible
			var permissions = OC.PERMISSION_READ;
			if (shareType === OC.Share.SHARE_TYPE_REMOTE) {
				permissions = OC.PERMISSION_CREATE | OC.PERMISSION_UPDATE | OC.PERMISSION_READ;
			} else {
				if (this.updatePermissionPossible()) {
					permissions = permissions | OC.PERMISSION_UPDATE;
				}
				if (this.createPermissionPossible()) {
					permissions = permissions | OC.PERMISSION_CREATE;
				}
				if (this.deletePermissionPossible()) {
					permissions = permissions | OC.PERMISSION_DELETE;
				}
				if (this.configModel.get('isResharingAllowed') && (this.sharePermissionPossible())) {
					permissions = permissions | OC.PERMISSION_SHARE;
				}
			}

			var model = this;
			var itemType = this.get('itemType');
			var itemSource = this.get('itemSource');
			OC.Share.share(itemType, itemSource, shareType, shareWith, permissions, fileName, options.expiration, function() {
				model.fetch();
				//FIXME: updateIcon belongs to view
				OC.Share.updateIcon(itemType, itemSource);
			});
		},

		/**
		 * @returns {boolean}
		 */
		isPublicUploadAllowed: function() {
			return this.get('allowPublicUploadStatus');
		},

		/**
		 * @returns {boolean}
		 */
		isFolder: function() {
			return this.get('itemType') === 'folder';
		},

		/**
		 * @returns {boolean}
		 */
		isFile: function() {
			return this.get('itemType') === 'file';
		},

		/**
		 * whether this item has reshare information
		 * @returns {boolean}
		 */
		hasReshare: function() {
			var reshare = this.get('reshare');
			return _.isObject(reshare) && !_.isUndefined(reshare.uid_owner);
		},

		/**
		 * whether this item has share information
		 * @returns {boolean}
		 */
		hasShares: function() {
			var shares = this.get('shares');
			return _.isArray(this.get('shares'));
		},

		/**
		 * @param {number} shareIndex
		 * @returns {string}
		 */
		getCollectionType: function(shareIndex) {
			/** @type OC.Share.Types.ShareInfo **/
			var share = this.get('shares')[shareIndex];
			if(!_.isObject(share)) {
				throw "Unknown Share";
			} else if(_.isUndefined(share.collection)) {
				throw "Share is not a collection";
			}

			return share.collection.item_type;
		},

		/**
		 * @param {number} shareIndex
		 * @returns {string}
		 */
		getCollectionPath: function(shareIndex) {
			/** @type OC.Share.Types.ShareInfo **/
			var share = this.get('shares')[shareIndex];
			if(!_.isObject(share)) {
				throw "Unknown Share";
			} else if(_.isUndefined(share.collection)) {
				throw "Share is not a collection";
			}

			return share.collection.path;
		},

		/**
		 * @param {number} shareIndex
		 * @returns {string}
		 */
		getCollectionSource: function(shareIndex) {
			/** @type OC.Share.Types.ShareInfo **/
			var share = this.get('shares')[shareIndex];
			if(!_.isObject(share)) {
				throw "Unknown Share";
			} else if(_.isUndefined(share.collection)) {
				throw "Share is not a collection";
			}

			return share.collection.item_source;
		},

		/**
		 * @param {number} shareIndex
		 * @returns {boolean}
		 */
		isCollection: function(shareIndex) {
			/** @type OC.Share.Types.ShareInfo **/
			var share = this.get('shares')[shareIndex];
			if(!_.isObject(share)) {
				throw "Unknown Share";
			}
			if(_.isUndefined(share.collection)) {
				return false;
			}
			return true;
		},


		/**
		 * @returns {string}
		 */
		getReshareOwner: function() {
			return this.get('reshare').uid_owner;
		},

		/**
		 * @returns {string}
		 */
		getReshareOwnerDisplayname: function() {
			return this.get('reshare').displayname_owner;
		},

		/**
		 * @returns {string}
		 */
		getReshareWith: function() {
			return this.get('reshare').share_with;
		},

		/**
		 * @returns {number}
		 */
		getReshareType: function() {
			return this.get('reshare').share_type;
		},

		/**
		 * @param shareIndex
		 * @returns {string}
		 */
		getShareWith: function(shareIndex) {
			/** @type OC.Share.Types.ShareInfo **/
			var share = this.get('shares')[shareIndex];
			if(!_.isObject(share)) {
				throw "Unknown Share";
			}
			return share.share_with;
		},

		/**
		 * @param shareIndex
		 * @returns {string}
		 */
		getShareWithDisplayName: function(shareIndex) {
			/** @type OC.Share.Types.ShareInfo **/
			var share = this.get('shares')[shareIndex];
			if(!_.isObject(share)) {
				throw "Unknown Share";
			}
			return share.share_with_displayname;
		},

		getShareType: function(shareIndex) {
			/** @type OC.Share.Types.ShareInfo **/
			var share = this.get('shares')[shareIndex];
			if(!_.isObject(share)) {
				throw "Unknown Share";
			}
			return share.share_type;
		},

		/**
		 * whether a share from shares has the requested permission
		 *
		 * @param {number} shareIndex
		 * @param {number} permission
		 * @returns {boolean}
		 * @private
		 */
		_shareHasPermission: function(shareIndex, permission) {
			/** @type OC.Share.Types.ShareInfo **/
			var share = this.get('shares')[shareIndex];
			if(!_.isObject(share)) {
				throw "Unknown Share";
			}
			if(   share.share_type === OC.Share.SHARE_TYPE_REMOTE
			   && (   permission === OC.PERMISSION_SHARE
				   || permission === OC.PERMISSION_DELETE))
			{
				return false;
			}
			return (share.permissions & permission) === permission;
		},

		notificationMailWasSent: function(shareIndex) {
			/** @type OC.Share.Types.ShareInfo **/
			var share = this.get('shares')[shareIndex];
			if(!_.isObject(share)) {
				throw "Unknown Share";
			}
			return share.share_mail_send === '1';
		},

		/**
		 * @returns {boolean}
		 */
		sharePermissionPossible: function() {
			return (this.get('permissions') & OC.PERMISSION_SHARE) === OC.PERMISSION_SHARE;
		},

		/**
		 * @param {number} shareIndex
		 * @returns {boolean}
		 */
		hasSharePermission: function(shareIndex) {
			return this._shareHasPermission(shareIndex, OC.PERMISSION_SHARE);
		},

		/**
		 * @returns {boolean}
		 */
		createPermissionPossible: function() {
			return (this.get('permissions') & OC.PERMISSION_CREATE) === OC.PERMISSION_CREATE;
		},

		/**
		 * @param {number} shareIndex
		 * @returns {boolean}
		 */
		hasCreatePermission: function(shareIndex) {
			return this._shareHasPermission(shareIndex, OC.PERMISSION_CREATE);
		},

		/**
		 * @returns {boolean}
		 */
		updatePermissionPossible: function() {
			return (this.get('permissions') & OC.PERMISSION_UPDATE) === OC.PERMISSION_UPDATE;
		},

		/**
		 * @param {number} shareIndex
		 * @returns {boolean}
		 */
		hasUpdatePermission: function(shareIndex) {
			return this._shareHasPermission(shareIndex, OC.PERMISSION_UPDATE);
		},

		/**
		 * @returns {boolean}
		 */
		deletePermissionPossible: function() {
			return (this.get('permissions') & OC.PERMISSION_DELETE) === OC.PERMISSION_DELETE;
		},

		/**
		 * @param {number} shareIndex
		 * @returns {boolean}
		 */
		hasDeletePermission: function(shareIndex) {
			return this._shareHasPermission(shareIndex, OC.PERMISSION_DELETE);
		},

		/**
		 * @returns {boolean}
		 */
		editPermissionPossible: function() {
			return    this.createPermissionPossible()
				   || this.updatePermissionPossible()
				   || this.deletePermissionPossible();
		},

		/**
		 * @returns {boolean}
		 */
		hasEditPermission: function(shareIndex) {
			return    this.hasCreatePermission(shareIndex)
				   || this.hasUpdatePermission(shareIndex)
				   || this.hasDeletePermission(shareIndex);
		},

		fetch: function() {
			var model = this;
			OC.Share.loadItem(this.get('itemType'), this.get('itemSource'), function(data) {
				model.set(model.parse(data));
			});
		},

		legacyFillCurrentShares: function(shares) {
			OC.Share.currentShares = {};
			OC.Share.itemShares = [];
			_.each(shares,
				/**
				 * @param {OC.Share.Types.ShareInfo} share
				 */
				function(share) {
					if (!OC.Share.currentShares[share.share_type]) {
						OC.Share.currentShares[share.share_type] = [];
					}
					OC.Share.currentShares[share.share_type].push(share);

					if (!OC.Share.itemShares[share.share_type]) {
						OC.Share.itemShares[share.share_type] = [];
					}
					OC.Share.itemShares[share.share_type].push(share.share_with);
				}
			);
		},

		parse: function(data) {
			if(data === false) {
				console.warn('no data was returned');
				trigger('fetchError');
				return {};
			}

			var permissions = this.get('possiblePermissions');
			if(!_.isUndefined(data.reshare) && !_.isUndefined(data.reshare.permissions)) {
				permissions = permissions & data.reshare.permissions;
			}

			var allowPublicUploadStatus = false;
			if(!_.isUndefined(data.shares)) {
				$.each(data.shares, function (key, value) {
					if (value.share_type === OC.Share.SHARE_TYPE_LINK) {
						allowPublicUploadStatus = (value.permissions & OC.PERMISSION_CREATE) ? true : false;
						return true;
					}
				});
			}

			/** @type {OC.Share.Types.ShareInfo[]} **/
			var shares = _.toArray(data.shares);
			this.legacyFillCurrentShares(shares);

			var linkShare = { isLinkShare: false };
			// filter out the share by link
			shares = _.reject(shares,
				/**
				 * @param {OC.Share.Types.ShareInfo} share
				 */
				function(share) {
					var isShareLink =
						share.share_type === OC.Share.SHARE_TYPE_LINK
						&& (   share.file_source === this.get('itemSource')
						|| share.item_source === this.get('itemSource'));

					if (isShareLink) {
						var link = window.location.protocol + '//' + window.location.host;
						if (!share.token) {
							// pre-token link
							var fullPath = this.fileInfoModel.get('path') + '/' +
								this.fileInfoModel.get('name');
							var location = '/' + OC.currentUser + '/files' + fullPath;
							var type = this.fileInfoModel.isDirectory() ? 'folder' : 'file';
							link += OC.linkTo('', 'public.php') + '?service=files&' +
								type + '=' + encodeURIComponent(location);
						} else {
							link += OC.generateUrl('/s/') + share.token;
						}
						linkShare = {
							isLinkShare: true,
							token: share.token,
							password: share.share_with,
							link: link,
							// currently expiration is only effective for link shares.
							expiration: share.expiration,
							stime: share.stime
						};

						return share;
					}
				},
				this
			);

			return {
				reshare: data.reshare,
				shares: shares,
				linkShare: linkShare,
				permissions: permissions,
				allowPublicUploadStatus: allowPublicUploadStatus
			};
		}
	});

	OC.Share.ShareItemModel = ShareItemModel;
})();

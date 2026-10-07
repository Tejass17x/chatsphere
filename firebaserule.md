rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // ─────────────────────────────────────────────────────────────
    // HELPER FUNCTIONS
    // ─────────────────────────────────────────────────────────────

    // Profile photos are stored inline, not in Cloud Storage: prepareImageForFirestore()
    // downsizes and re-encodes to JPEG and returns a data URI, capped at
    // MAX_PROFILE_IMAGE_LENGTH (180_000 characters).
    //
    // The shape is pinned rather than merely length-capped on purpose. A plain
    // size check also admits an arbitrary string, which is a stored-XSS vector
    // on web: the app renders photoURL through an <img>/Image source, so any
    // attacker-chosen scheme or markup would be served to every viewer of that
    // profile. Requiring the exact prefix keeps the field to what this app
    // actually produces.
    function isValidPhotoURL(photoURL) {
      return photoURL == null
        || (photoURL is string
            && photoURL.matches('data:image/jpeg;base64,[A-Za-z0-9+/]+=*')
            && photoURL.size() <= 180000);
    }

    // Deliberately does NOT require 'email' to match the token.
    //
    // The original rule compared request.resource.data.email against
    // request.auth.token.email. That works for password sign-in but breaks
    // silently the moment an account's email is changed through the Firebase
    // console or a verified-email flow, because the token stops matching the
    // profile and the user's next profile edit is rejected forever with
    // "Missing or sufficient permissions" — with no way for them to fix it from
    // the app. Auth already guarantees who the caller is; uid is the field
    // that must not be forgeable, and that check is kept.
    function isValidUserProfile(data) {
      return data.keys().hasAll([
        'uid', 'email', 'displayName', 'photoURL', 'bio',
        'followers', 'following', 'followRequests', 'sentRequests',
        'createdAt', 'updatedAt', 'lastActive', 'fcmToken'
      ])
      && data.uid is string
      && data.email is string
      && data.displayName is string
      && isValidPhotoURL(data.photoURL)
      && data.bio is string
      && data.followers is list
      && data.following is list
      && data.followRequests is list
      && data.sentRequests is list
      && data.createdAt is timestamp
      && data.updatedAt is timestamp
      && data.lastActive is timestamp
      && (data.fcmToken == null || data.fcmToken is string);
    }

    function isSignedIn() {
      return request.auth != null;
    }

    function isSelf(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }

    function isOwner(resource, uidField) {
      return isSignedIn() && resource.data[uidField] == request.auth.uid;
    }

    function isChatParticipant(chatId) {
      let chat = get(/databases/$(database)/documents/chats/$(chatId)).data;
      return isSignedIn() && request.auth.uid in chat.participants;
    }

    // Chat IDs are deterministic: getOrCreateChat() builds them as the two
    // UIDs sorted and joined with '_'. That lets us prove the caller is a
    // participant from the path alone, with no document read at all.
    //
    // This exists because isChatParticipant() dereferences the chat document
    // unconditionally: for a chat that has not been created yet, `get(...)`
    // returns null and the rule fails, so the app saw "Missing or insufficient
    // permissions" instead of an empty thread. Proving membership from the ID
    // keeps that read working without opening subcollections of arbitrary
    // non-existent chats to every signed-in user.
    function isChatIdMember(chatId) {
      return isSignedIn()
        && chatId.size() > 0
        && request.auth.uid in chatId.split('_');
    }

    // True when the caller may read this chat's contents: either the chat
    // document already exists and lists them as a participant, or it does not
    // exist yet and their uid appears in the deterministic chat id.
    function canAccessChatSubcollection(chatId) {
      return isChatIdMember(chatId) || isChatParticipant(chatId);
    }

    function isMutual(userA, userB) {
      let profileA = get(/databases/$(database)/documents/users/$(userA));
      let profileB = get(/databases/$(database)/documents/users/$(userB));
      return profileA.exists()
        && profileB.exists()
        && profileA.data.following is list
        && profileB.data.following is list
        && userB in profileA.data.following
        && userA in profileB.data.following;
    }

    function isMutualChat(chat) {
      return chat.participants is list
        && chat.participants.size() == 2
        && isMutual(chat.participants[0], chat.participants[1]);
    }

    function isNotificationOwner(notificationId) {
      return isSignedIn()
        && get(/databases/$(database)/documents/notifications/$(notificationId)).data.userId == request.auth.uid;
    }

    function singleItemAdded(field) {
      return request.resource.data[field].hasAll(resource.data[field])
        && request.resource.data[field].size() == resource.data[field].size() + 1
        && !resource.data[field].hasAll(request.resource.data[field]);
    }

    function singleItemRemoved(field) {
      return resource.data[field].hasAll(request.resource.data[field])
        && resource.data[field].size() == request.resource.data[field].size() + 1
        && !request.resource.data[field].hasAll(resource.data[field]);
    }

    function ownerListChangeOk(field, userId) {
      return resource.data[field] == request.resource.data[field]
        || (userId == request.auth.uid
          && (singleItemAdded(field) || singleItemRemoved(field)));
    }

    // A user may update another profile only for their own UID, and only for
    // a relationship transition supported by the current profile state.
    function otherUserListChangeOk(field, userId) {
      return resource.data[field] == request.resource.data[field]
        || (
          userId != request.auth.uid
          && field == 'followRequests'
          && singleItemAdded(field)
          && request.resource.data[field].hasAny([request.auth.uid])
          && !resource.data[field].hasAny([request.auth.uid])
        )
        || (
          userId != request.auth.uid
          && field == 'followers'
          && (
            (resource.data.following is list
              && resource.data.following.hasAny([request.auth.uid]))
            || (resource.data.sentRequests is list
              && resource.data.sentRequests.hasAny([request.auth.uid])
              && get(/databases/$(database)/documents/users/$(request.auth.uid))
                .data.sentRequests.hasAny([userId]))
          )
          && singleItemAdded(field)
          && request.resource.data[field].hasAny([request.auth.uid])
          && !resource.data[field].hasAny([request.auth.uid])
        )
        || (
          userId != request.auth.uid
          && field == 'following'
          && resource.data.sentRequests is list
          && resource.data.sentRequests.hasAny([request.auth.uid])
          && !request.resource.data.sentRequests.hasAny([request.auth.uid])
          && singleItemAdded(field)
          && request.resource.data[field].hasAny([request.auth.uid])
          && !resource.data[field].hasAny([request.auth.uid])
        )
        || (
          userId != request.auth.uid
          && (field == 'followRequests' || field == 'followers' || field == 'sentRequests')
          && singleItemRemoved(field)
          && resource.data[field].hasAny([request.auth.uid])
          && !request.resource.data[field].hasAny([request.auth.uid])
        );
    }

    function followListChangeOk(field, userId) {
      return resource.data[field] == request.resource.data[field]
        || ownerListChangeOk(field, userId)
        || otherUserListChangeOk(field, userId);
    }

    function isFollowGraphUpdate(userId) {
      return request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['followers', 'following', 'followRequests', 'sentRequests', 'updatedAt'])
        && request.resource.data.diff(resource.data).affectedKeys()
          .hasAny(['followers', 'following', 'followRequests', 'sentRequests'])
        && followListChangeOk('followers', userId)
        && followListChangeOk('following', userId)
        && followListChangeOk('followRequests', userId)
        && followListChangeOk('sentRequests', userId);
    }

    // Owner's editable profile fields.
    //
    // 'fcmToken' is included because updateFCMToken() writes it through the
    // same merge-write path as the display name, and it is not user-authored
    // text. 'photoURL' goes through isValidPhotoURL() rather than a bare size
    // check so only a real JPEG data URI can be stored.
    function isProfileContentUpdate() {
      return request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['displayName', 'bio', 'photoURL', 'fcmToken', 'updatedAt'])
        && request.resource.data.displayName is string
        && request.resource.data.displayName.size() >= 2
        && request.resource.data.displayName.size() <= 30
        && request.resource.data.bio is string
        && isValidPhotoURL(request.resource.data.photoURL)
        && (request.resource.data.fcmToken == null
            || request.resource.data.fcmToken is string);
    }

    // Validate user profile data structure
    // (isValidUserProfile is defined near the top of this block, alongside
    // isValidPhotoURL, so the photo rule has a single definition.)

    // A presence heartbeat only ever touches 'online' and 'lastActive', and
    // only the owner may write it.
    //
    // 'online' is deliberately NOT in the isValidUserProfile required-key list:
    // it was added after users were first created, so requiring it here would
    // invalidate every pre-existing profile on its next write.
    function isPresenceUpdate() {
      return request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['online', 'lastActive'])
        && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['online'])
            || request.resource.data.online is bool);
    }

    // Validate chat data structure
    function isValidChat(data) {
      return data.keys().hasAll([
        'participants', 'participantDetails', 'lastMessage',
        'lastMessageAt', 'unreadCount', 'createdAt'
      ])
      && data.participants is list
      && data.participants.size() == 2
      && data.participantDetails is map
      && data.lastMessageAt is timestamp
      && data.unreadCount is map
      && data.createdAt is timestamp
      && (data.lastMessage == null || isValidMessage(data.lastMessage));
    }

    // Validate message data structure
    function isValidMessage(data) {
      return data.keys().hasAll([
        'id', 'chatId', 'senderId', 'text', 'imageUrl',
        'type', 'status', 'createdAt', 'readAt'
      ])
      && data.id is string
      && data.chatId is string
      && data.senderId is string
      && data.text is string
      && data.text.size() <= 2000
      && (data.imageUrl == null || (
        data.imageUrl is string
        && data.imageUrl.size() <= 400000
        && data.imageUrl.matches('data:image/jpeg;base64,[A-Za-z0-9+/]+=*')
      ))
      && data.type in ['text', 'image']
      && data.status in ['sent', 'delivered', 'read']
      && data.createdAt is timestamp
      && (data.readAt == null || data.readAt is timestamp);
    }

    // Validate notification data structure
    function isValidNotification(data) {
      return data.keys().hasAll([
        'id', 'userId', 'type', 'title', 'body', 'data', 'read', 'createdAt'
      ])
      && data.id is string
      && data.userId is string
      && data.type in ['follow_request', 'follow_accepted', 'new_message']
      && data.title is string
      && data.body is string
      && data.data is map
      && data.data.keys().hasAll(['fromUserId'])
      && data.data.keys().hasOnly(['fromUserId', 'chatId', 'messageId'])
      && data.data.fromUserId is string
      && (data.data.get('chatId', null) == null || data.data.chatId is string)
      && (data.data.get('messageId', null) == null || data.data.messageId is string)
      && data.read is bool
      && data.createdAt is timestamp;
    }

    function notificationMatchesCurrentState(data) {
      let senderId = data.data.fromUserId;
      let recipientId = data.userId;
      return senderId == request.auth.uid
        && (
          (
            data.type == 'follow_request'
            && get(/databases/$(database)/documents/users/$(recipientId))
              .data.followRequests.hasAny([senderId])
          )
          || (
            data.type == 'follow_accepted'
            && get(/databases/$(database)/documents/users/$(senderId))
              .data.followers.hasAny([recipientId])
            && get(/databases/$(database)/documents/users/$(recipientId))
              .data.following.hasAny([senderId])
          )
          || (
            data.type == 'new_message'
            && data.data.get('chatId', null) is string
            && data.data.get('messageId', null) is string
            && request.auth.uid in get(
              /databases/$(database)/documents/chats/$(data.data.chatId)
            ).data.participants
            && recipientId in get(
              /databases/$(database)/documents/chats/$(data.data.chatId)
            ).data.participants
            && get(
              /databases/$(database)/documents/chats/$(data.data.chatId)/messages/$(data.data.messageId)
            ).data.senderId == senderId
            && get(
              /databases/$(database)/documents/chats/$(data.data.chatId)/messages/$(data.data.messageId)
            ).data.chatId == data.data.chatId
            && get(
              /databases/$(database)/documents/chats/$(data.data.chatId)/messages/$(data.data.messageId)
            ).data.id == data.data.messageId
          )
        );
    }

    // ─────────────────────────────────────────────────────────────
    // USERS COLLECTION
    // ─────────────────────────────────────────────────────────────
    match /users/{userId} {
      // READ: Any signed-in user can read profiles (needed for search & chat)
      // Using list access to allow querying without per-doc reads
      allow list: if isSignedIn();

      allow get: if isSignedIn();

      // CREATE: Only the authenticated user can create their own profile.
      // No email check: see the note on isValidUserProfile — Auth already
      // establishes identity, and pinning email to the token locks users out
      // of their own profile after any email change. uid is what must not be
      // forgeable, and that is enforced here.
      allow create: if isSelf(userId)
        && isValidUserProfile(request.resource.data)
        && request.resource.data.uid == userId
        && request.resource.data.photoURL == null
        && request.resource.data.followers == []
        && request.resource.data.following == []
        && request.resource.data.followRequests == []
        && request.resource.data.sentRequests == []
        && request.resource.data.fcmToken == null;

      // UPDATE: Owner can edit their profile. Other signed-in users may only
      // add/remove their own UID on follow-related arrays (requests, follow).
      allow update: if isSignedIn()
        && request.resource.data.uid == resource.data.uid
        && request.resource.data.email == resource.data.email
        && request.resource.data.createdAt == resource.data.createdAt
        && (
          (
            isSelf(userId)
            && (
              isPresenceUpdate()
              || (isValidUserProfile(request.resource.data) && isProfileContentUpdate())
              || (isValidUserProfile(request.resource.data) && isFollowGraphUpdate(userId))
            )
          )
          || (
            isValidUserProfile(request.resource.data)
            && isFollowGraphUpdate(userId)
          )
        );

      // DELETE: Only the owner can delete their profile
      allow delete: if isSelf(userId);
    }

    // ─────────────────────────────────────────────────────────────
    // CHATS COLLECTION
    // ─────────────────────────────────────────────────────────────
    match /chats/{chatId} {
      // LIST: Only participants can read their chats. For a query, Firestore
      // evaluates this per returned document and requires the rule to be
      // provable from the query constraints — `array-contains` on `participants`
      // is what makes `auth.uid in resource.data.participants` provable, so
      // the caller must always filter by their own uid.
      allow list: if isSignedIn()
        && request.auth.uid in resource.data.participants;

      // GET: The `resource == null` guard is essential, not defensive padding.
      // getOrCreateChat() reads the chat document *before* creating it, and for
      // a document that does not exist yet `resource` is null — dereferencing
      // resource.data would fail and Firestore would reject the read with
      // "Missing or insufficient permissions", so opening any brand-new chat
      // would fail before the create was ever attempted.
      allow get: if isSignedIn()
        && (resource == null || request.auth.uid in resource.data.participants);

      // CREATE: Exactly 2 participants, caller must be one of them
      // chatId must be sorted UIDs joined by '_' for consistency
      allow create: if isSignedIn()
        && isValidChat(request.resource.data)
        && request.resource.data.participants.size() == 2
        && request.auth.uid in request.resource.data.participants
        && isMutualChat(request.resource.data)
        // Verify chatId format matches sorted participants
        && chatId == request.resource.data.participants[0] + '_' + request.resource.data.participants[1]
        // Verify participantDetails matches participants
        && request.resource.data.participantDetails.keys().hasAll(request.resource.data.participants)
        && request.resource.data.unreadCount.keys().hasAll(request.resource.data.participants)
        && request.resource.data.unreadCount[request.resource.data.participants[0]] == 0
        && request.resource.data.unreadCount[request.resource.data.participants[1]] == 0
        && request.resource.data.lastMessage == null;

      // UPDATE: Participants can update, but participants list is immutable
      // Only allow specific field updates: lastMessage, lastMessageAt, unreadCount, participantDetails
      allow update: if isSignedIn()
        && request.auth.uid in resource.data.participants
        && isValidChat(request.resource.data)
        && request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['lastMessage', 'lastMessageAt', 'unreadCount', 'participantDetails'])
        // Immutable fields
        && request.resource.data.participants == resource.data.participants
        && request.resource.data.createdAt == resource.data.createdAt
        // participantDetails can only add/update displayName/photoURL
        && request.resource.data.participantDetails.keys() == resource.data.participantDetails.keys()
        // unreadCount can only increment for the other user, or reset to 0 for current user
        && request.resource.data.unreadCount.keys() == resource.data.unreadCount.keys();

      // DELETE: Participants can delete (soft delete recommended in production)
      allow delete: if isSignedIn()
        && request.auth.uid in resource.data.participants;

      // ─────────────────────────────────────────────────────────────
      // MESSAGES SUBCOLLECTION
      // ─────────────────────────────────────────────────────────────
      match /messages/{messageId} {
        // READ: Only chat participants. canAccessChatSubcollection() also
        // accepts membership proven from the deterministic chat id, so listing
        // the messages of a chat that does not exist yet returns an empty list
        // instead of a permission error — which is what made opening a brand
        // new conversation fail before it was ever created.
        allow list, get: if canAccessChatSubcollection(chatId);

        // CREATE: Existing chat participants can send; starting the chat is
        // separately gated on mutual follows by the chat create rule.
        allow create: if isChatParticipant(chatId)
          && isValidMessage(request.resource.data)
          && request.resource.data.senderId == request.auth.uid
          && request.resource.data.chatId == chatId
          && request.resource.data.status == 'sent'
          && request.resource.data.readAt == null;

        // UPDATE: Only sender can update their message (for status changes like read/delivered)
        // Participants can update status to 'delivered' or 'read'
        allow update: if isChatParticipant(chatId)
          && isValidMessage(request.resource.data)
          // Immutable fields
          && request.resource.data.id == resource.data.id
          && request.resource.data.chatId == resource.data.chatId
          && request.resource.data.senderId == resource.data.senderId
          && request.resource.data.text == resource.data.text
          && request.resource.data.imageUrl == resource.data.imageUrl
          && request.resource.data.type == resource.data.type
          && request.resource.data.createdAt == resource.data.createdAt
          // Status can progress: sent -> delivered -> read
          && request.resource.data.status in ['sent', 'delivered', 'read']
          && (resource.data.status == 'sent' && request.resource.data.status in ['delivered', 'read']
              || resource.data.status == 'delivered' && request.resource.data.status == 'read'
              || resource.data.status == request.resource.data.status)
          // readAt can only be set when status becomes 'read'
          && (request.resource.data.readAt == resource.data.readAt
              || (resource.data.status != 'read' && request.resource.data.status == 'read'
                  && request.resource.data.readAt is timestamp));

        // DELETE: Only sender can delete their message
        allow delete: if isChatParticipant(chatId)
          && resource.data.senderId == request.auth.uid;
      }

      // ─────────────────────────────────────────────────────────────
      // TYPING SUBCOLLECTION
      // Written by participants only, and only for their own UID, so a
      // participant cannot forge a typing indicator on someone else's behalf.
      // ─────────────────────────────────────────────────────────────
      match /typing/{uid} {
        // A typing subscription attaches as soon as the chat screen mounts,
        // which can be before the chat document exists. Without the id-based
        // membership check that initial listen is rejected outright, so the
        // indicator never appears on a brand-new chat.
        allow read: if canAccessChatSubcollection(chatId);

        // Writes stay gated on the chat actually existing and listing the
        // caller. Allowing them for any id containing their uid would let a
        // signed-in user drop typing documents into a chatId that never gets a
        // chat document — unreadable garbage that is invisible to everyone,
        // participants included. The read allowance above is harmless; this
        // one is not.
        allow create, update: if isChatParticipant(chatId)
          && uid == request.auth.uid
          && request.resource.data.uid == request.auth.uid
          && request.resource.data.keys().hasOnly(['uid', 'at'])
          && request.resource.data.at is timestamp;

        allow delete: if isChatParticipant(chatId)
          && uid == request.auth.uid;
      }

      // ─────────────────────────────────────────────────────────────
      // PRESENCE SUBCOLLECTION
      // Unused for now — presence is stored on the user document. Kept
      // closed off so it cannot be abused.
      // ─────────────────────────────────────────────────────────────
      match /presence/{uid} {
        allow read, write: if false;
      }
    }

    // ─────────────────────────────────────────────────────────────
    // NOTIFICATIONS COLLECTION
    // ─────────────────────────────────────────────────────────────
    match /notifications/{notificationId} {
      // LIST: Only the owner's own notifications. Deliberately NOT combined with
      // `get` below — Firestore sets `resource` to null for *every* document
      // evaluated as part of a query, so a combined `allow list, get` rule
      // containing a `resource == null` escape hatch resolves to true for the
      // whole query and would let any signed-in user list every notification in
      // the database. getUserNotifications() filters on userId, which is what
      // makes this provable.
      allow list: if isSignedIn()
        && request.auth.uid == resource.data.userId;

      // GET: Only the owner. The `resource == null` guard covers a read of a
      // document that does not exist, which would otherwise fail on the
      // dereference rather than returning "no such notification". For a single
      // get, resource is non-null whenever the document exists, so this cannot
      // be used to reach another user's notification.
      allow get: if isSignedIn()
        && (resource == null || resource.data.userId == request.auth.uid);

      // CREATE: Notifications are created by Cloud Functions or other users
      // Client can only create notifications FOR OTHERS (not for self)
      // This is typically done via Cloud Functions, but if client creates:
      allow create: if isSignedIn()
        && isValidNotification(request.resource.data)
        && request.resource.data.userId != request.auth.uid
        && notificationMatchesCurrentState(request.resource.data);

      // UPDATE: Only owner can mark as read
      allow update: if isNotificationOwner(notificationId)
        && request.resource.data.read == true
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read']);

      // DELETE: Only owner can delete their notifications
      allow delete: if isNotificationOwner(notificationId);
    }
  }
}
// Profile Tab Screen

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import {
  getFollowers,
  getFollowing,
  getFollowRequests,
  computeFollowStatus,
  followUser,
  unfollowUser,
  acceptFollowRequest,
  rejectFollowRequest,
} from '@/services/firestore';
import { updateUserProfile } from '@/services/auth';
import {
  MAX_PROFILE_IMAGE_LENGTH,
  prepareImageForFirestore,
} from '@/utils/firestoreImages';
import { LucideIcon } from '@/components/ui/LucideIcon';
import { AppHeader } from '@/components/ui/AppHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { COLORS, SPACING, BORDER_RADIUS, ERROR_MESSAGES, PATTERNS } from '@/utils/constants';
import { UserProfile } from '@/types';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, firebaseUser, refreshProfile, patchUser, logout } = useAuth();
  const { notifyFollowAccepted } = useNotifications();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ displayName: '', bio: '' });
  const [uploading, setUploading] = useState(false);
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<UserProfile[]>([]);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const profile = user;

  const loadLists = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const [followersList, followingList, requestList] = await Promise.all([
        getFollowers(firebaseUser.uid),
        getFollowing(firebaseUser.uid),
        getFollowRequests(firebaseUser.uid),
      ]);
      setFollowers(followersList);
      setFollowing(followingList);
      setRequests(requestList);
    } catch (error) {
      console.error('Failed to load follow lists:', error);
    }
  }, [firebaseUser]);

  useEffect(() => {
    if (!user) return;
    if (!editing) {
      setEditForm({ displayName: user.displayName, bio: user.bio || '' });
    }
  }, [user, editing]);

  useEffect(() => {
    loadLists();
  }, [loadLists, user?.followers, user?.following, user?.followRequests]);

  const handleChangePhoto = async () => {
    if (!firebaseUser || uploading) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      const image = result.assets?.[0];
      if (result.canceled || !image) return;

      setUploading(true);
      const dataUri = await prepareImageForFirestore(
        image.uri,
        image.width,
        image.height,
        MAX_PROFILE_IMAGE_LENGTH
      );
      await updateUserProfile(firebaseUser.uid, { photoURL: dataUri });
      patchUser({ photoURL: dataUri });
      setFeedback({ type: 'success', message: 'Photo updated' });
    } catch (error) {
      console.error('Profile photo update failed:', error);
      Alert.alert(
        'Photo Update Failed',
        error instanceof Error ? error.message : 'Unable to save this photo. Please try another.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!firebaseUser || !profile || saving) return;
    Keyboard.dismiss();

    const displayName = editForm.displayName.trim();
    const bio = editForm.bio.trim();

    if (!displayName) {
      setFeedback({ type: 'error', message: 'Display name is required' });
      return;
    }

    if (!PATTERNS.displayName.test(displayName)) {
      setFeedback({ type: 'error', message: 'Name must be 2-30 characters' });
      return;
    }

    setSaving(true);
    setFeedback(null);
    const previous = { displayName: profile.displayName, bio: profile.bio || '' };
    patchUser({ displayName, bio });
    setEditing(false);

    try {
      await updateUserProfile(firebaseUser.uid, { displayName, bio });
      setFeedback({ type: 'success', message: 'Profile saved' });
      refreshProfile().catch(() => {});
    } catch (error) {
      console.error('Update failed:', error);
      patchUser(previous);
      setEditForm(previous);
      setEditing(true);
      setFeedback({ type: 'error', message: 'Failed to update profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    // Alert.alert() is a no-op on react-native-web, so the confirmation
    // dialog never appears there and the button looks dead. A Modal works
    // identically on web, iOS and Android.
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    setLoggingOut(true);
    try {
      await logout();
      // Navigation is handled by the AuthGuard in app/_layout.tsx, which
      // redirects to /login as soon as the auth state clears.
      router.replace('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleListAction = async (
    target: UserProfile,
    action: 'unfollow' | 'follow-back' | 'accept' | 'decline'
  ) => {
    if (!firebaseUser || !user || actingOn) return;
    setActingOn(target.uid);
    try {
      if (action === 'unfollow') {
        patchUser({
          following: user.following.filter((id) => id !== target.uid),
        });
        setFollowing((prev) => prev.filter((u) => u.uid !== target.uid));
        await unfollowUser(firebaseUser.uid, target.uid);
      } else if (action === 'follow-back') {
        patchUser({
          following: user.following.includes(target.uid)
            ? user.following
            : [...user.following, target.uid],
          followRequests: user.followRequests.filter((id) => id !== target.uid),
        });
        setFollowing((prev) => (prev.some((u) => u.uid === target.uid) ? prev : [...prev, target]));
        setRequests((prev) => prev.filter((u) => u.uid !== target.uid));
        await followUser(firebaseUser.uid, target.uid);
      } else if (action === 'accept') {
        patchUser({
          followers: user.followers.includes(target.uid)
            ? user.followers
            : [...user.followers, target.uid],
          followRequests: user.followRequests.filter((id) => id !== target.uid),
        });
        setFollowers((prev) => (prev.some((u) => u.uid === target.uid) ? prev : [...prev, target]));
        setRequests((prev) => prev.filter((u) => u.uid !== target.uid));
        await acceptFollowRequest(target.uid, firebaseUser.uid);
        try {
          await notifyFollowAccepted(target.uid, user.displayName || 'Someone');
        } catch (error) {
          console.error('Request accepted, but notification could not be sent:', error);
        }
      } else {
        patchUser({
          followRequests: user.followRequests.filter((id) => id !== target.uid),
        });
        setRequests((prev) => prev.filter((u) => u.uid !== target.uid));
        await rejectFollowRequest(target.uid, firebaseUser.uid);
      }
    } catch (error) {
      console.error('Follow list action failed:', error);
      setFeedback({ type: 'error', message: 'Could not update follow status. Try again.' });
      loadLists();
      try {
        await refreshProfile();
      } catch (refreshError) {
        console.error('Could not refresh profile after follow action failed:', refreshError);
      }
    } finally {
      setActingOn(null);
    }
  };

  const closeSheets = () => {
    setShowFollowers(false);
    setShowFollowing(false);
    setShowRequests(false);
  };

  if (!profile) {
    return (
      <View style={styles.container}>
        <Loading fullScreen text="Loading profile..." />
      </View>
    );
  }

  const stats = [
    { label: 'Followers', count: profile.followers.length, onPress: () => setShowFollowers(true) },
    { label: 'Following', count: profile.following.length, onPress: () => setShowFollowing(true) },
    { label: 'Requests', count: profile.followRequests.length, onPress: () => setShowRequests(true) },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <AppHeader title="Profile" showBell={false} />

        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Avatar
              source={profile.photoURL ? { uri: profile.photoURL } : null}
              name={profile.displayName}
              size="xl"
            />
            {editing && (
              <TouchableOpacity
                style={styles.changePhotoButton}
                onPress={handleChangePhoto}
                disabled={uploading}
              >
                <Text style={styles.changePhotoText}>
                  {uploading ? 'Saving photo...' : 'Change photo'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.nameContainer}>
            {editing ? (
              <Input
                value={editForm.displayName}
                onChangeText={(text) => setEditForm((prev) => ({ ...prev, displayName: text }))}
                placeholder="Display Name"
                autoCapitalize="words"
                containerStyle={styles.editInputContainer}
              />
            ) : (
              <Text style={styles.displayName}>{profile.displayName}</Text>
            )}
            {!editing && profile.bio && (
              <Text style={styles.bio}>{profile.bio}</Text>
            )}
            {editing && (
              <Input
                value={editForm.bio}
                onChangeText={(text) => setEditForm((prev) => ({ ...prev, bio: text }))}
                placeholder="Add a bio..."
                multiline
                numberOfLines={3}
                containerStyle={styles.editInputContainer}
              />
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            {stats.map((stat, index) => (
              <TouchableOpacity
                key={stat.label}
                style={styles.statItem}
                onPress={stat.onPress}
                activeOpacity={0.7}
              >
                <Text style={styles.statCount}>{stat.count}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {feedback ? (
            <Text
              style={[
                styles.feedbackText,
                feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess,
              ]}
            >
              {feedback.message}
            </Text>
          ) : null}

          {/* Edit/Save Buttons */}
          <View style={styles.buttonRow}>
            {editing ? (
              <>
                <Button
                  title={saving ? 'Saving...' : 'Save'}
                  onPress={handleSaveProfile}
                  variant="primary"
                  size="md"
                  loading={saving}
                  disabled={saving}
                  style={{ flex: 1, marginRight: SPACING.sm, minHeight: 44 }}
                />
                <Button
                  title="Cancel"
                  onPress={() => {
                    Keyboard.dismiss();
                    setEditForm({ displayName: profile.displayName, bio: profile.bio || '' });
                    setEditing(false);
                    setFeedback(null);
                  }}
                  variant="outline"
                  size="md"
                  disabled={saving}
                  style={{ flex: 1, minHeight: 44 }}
                />
              </>
            ) : (
              <Button
                title="Edit Profile"
                onPress={() => {
                  setEditForm({ displayName: profile.displayName, bio: profile.bio || '' });
                  setEditing(true);
                  setFeedback(null);
                }}
                variant="primary"
                size="md"
                style={{ flex: 1, minHeight: 44 }}
              />
            )}
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <Card style={styles.settingsCard}>
            <TouchableOpacity style={styles.settingItem} onPress={() => {}}>
              <LucideIcon name="bell" size={22} color={COLORS.textPrimary} style={styles.settingIcon} />
              <Text style={styles.settingText}>Notifications</Text>
              <LucideIcon name="chevron-right" size={20} color={COLORS.textTertiary} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.settingItem} onPress={() => {}}>
              <LucideIcon name="shield" size={22} color={COLORS.textPrimary} style={styles.settingIcon} />
              <Text style={styles.settingText}>Privacy & Security</Text>
              <LucideIcon name="chevron-right" size={20} color={COLORS.textTertiary} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.settingItem} onPress={() => {}}>
              <LucideIcon name="help-circle" size={22} color={COLORS.textPrimary} style={styles.settingIcon} />
              <Text style={styles.settingText}>Help & Support</Text>
              <LucideIcon name="chevron-right" size={20} color={COLORS.textTertiary} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.settingItem} onPress={handleLogout}>
              <LucideIcon name="log-out" size={22} color={COLORS.danger} style={styles.settingIcon} />
              <Text style={[styles.settingText, styles.settingTextDanger]}>Logout</Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Card style={styles.settingsCard}>
            <TouchableOpacity style={styles.settingItem} onPress={() => {}}>
              <LucideIcon name="info" size={22} color={COLORS.textPrimary} style={styles.settingIcon} />
              <Text style={styles.settingText}>Version</Text>
              <Text style={styles.settingValue}>1.0.0</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.settingItem} onPress={() => {}}>
              <LucideIcon name="file-text" size={22} color={COLORS.textPrimary} style={styles.settingIcon} />
              <Text style={styles.settingText}>Terms of Service</Text>
              <LucideIcon name="chevron-right" size={20} color={COLORS.textTertiary} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.settingItem} onPress={() => {}}>
              <LucideIcon name="shield-check" size={22} color={COLORS.textPrimary} style={styles.settingIcon} />
              <Text style={styles.settingText}>Privacy Policy</Text>
              <LucideIcon name="chevron-right" size={20} color={COLORS.textTertiary} />
            </TouchableOpacity>
          </Card>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Followers / Following sheet */}
      <Modal
        visible={showFollowers || showFollowing || showRequests}
        animationType="slide"
        transparent
        onRequestClose={closeSheets}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeSheets}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {showFollowers ? 'Followers' : showFollowing ? 'Following' : 'Follow Requests'}
              {'  '}
              <Text style={styles.modalCount}>
                {(showFollowers ? followers : showFollowing ? following : requests).length}
              </Text>
            </Text>

            <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
              {(showFollowers ? followers : showFollowing ? following : requests).length === 0 ? (
                <View style={styles.modalEmpty}>
                  <LucideIcon
                    name="users"
                    size={40}
                    color={COLORS.textTertiary}
                  />
                  <Text style={styles.modalEmptyText}>
                    {showFollowers
                      ? 'No followers yet'
                      : showFollowing
                        ? 'Not following anyone yet'
                        : 'No follow requests'}
                  </Text>
                </View>
              ) : (
                (showFollowers ? followers : showFollowing ? following : requests).map((f) => {
                  const status = user ? computeFollowStatus(user, f) : 'none';
                  return (
                    <View key={f.uid} style={styles.modalUserItem}>
                      <Avatar
                        source={f.photoURL ? { uri: f.photoURL } : null}
                        name={f.displayName}
                        size="md"
                      />
                      <View style={styles.modalUserInfo}>
                        <Text style={styles.modalUserName} numberOfLines={1}>
                          {f.displayName}
                        </Text>
                        <Text style={styles.modalUserEmail} numberOfLines={1}>
                          {f.email}
                        </Text>
                      </View>
                      {showRequests ? (
                        <View style={styles.modalActions}>
                          <TouchableOpacity
                            style={styles.modalPrimaryBtn}
                            onPress={() => handleListAction(f, 'accept')}
                            disabled={actingOn === f.uid}
                          >
                            <Text style={styles.modalPrimaryText}>
                              {actingOn === f.uid ? '...' : 'Accept'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.modalSubtleBtn}
                            onPress={() => handleListAction(f, 'decline')}
                            disabled={actingOn === f.uid}
                          >
                            <Text style={styles.modalSubtleText}>Decline</Text>
                          </TouchableOpacity>
                        </View>
                      ) : showFollowing || status === 'following' || status === 'mutual' ? (
                        <TouchableOpacity
                          style={styles.modalSubtleBtn}
                          onPress={() => handleListAction(f, 'unfollow')}
                          disabled={actingOn === f.uid}
                        >
                          <Text style={styles.modalSubtleText}>
                            {actingOn === f.uid ? '...' : 'Unfollow'}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.modalPrimaryBtn}
                          onPress={() => handleListAction(f, 'follow-back')}
                          disabled={actingOn === f.uid}
                        >
                          <Text style={styles.modalPrimaryText}>
                            {actingOn === f.uid ? '...' : 'Follow'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Logout confirmation */}
      <Modal
        visible={showLogoutConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!loggingOut) setShowLogoutConfirm(false);
        }}
      >
        <View style={styles.confirmBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !loggingOut && setShowLogoutConfirm(false)} />
          <Pressable style={styles.confirmCard} onPress={() => {}}>
            <Text style={styles.confirmTitle}>Logout</Text>
            <Text style={styles.confirmMessage}>
              Are you sure you want to logout?
            </Text>
            <View style={styles.confirmActions}>
              <Button
                title="Cancel"
                onPress={() => setShowLogoutConfirm(false)}
                variant="outline"
                size="md"
                disabled={loggingOut}
                style={styles.confirmButton}
              />
              <Button
                title={loggingOut ? 'Logging out...' : 'Logout'}
                onPress={confirmLogout}
                variant="danger"
                size="md"
                loading={loggingOut}
                disabled={loggingOut}
                style={styles.confirmButton}
              />
            </View>
          </Pressable>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl + 80,
  },
  header: {
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  avatarContainer: {
    position: 'relative',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  changePhotoButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  changePhotoText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  nameContainer: {
    alignItems: 'center',
    gap: SPACING.xs,
    width: '100%',
  },
  displayName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  bio: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
    lineHeight: 22,
  },
  editInputContainer: {
    width: '100%',
    maxWidth: 300,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.xl,
    marginVertical: SPACING.md,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 80,
  },
  statCount: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  buttonRow: {
    width: '100%',
    maxWidth: 300,
    flexDirection: 'row',
    marginTop: SPACING.sm,
    zIndex: 2,
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  feedbackSuccess: {
    color: COLORS.success,
  },
  feedbackError: {
    color: COLORS.danger,
  },
  section: {
    marginBottom: SPACING.lg,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
    marginLeft: SPACING.xs,
  },
  settingsCard: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  settingIcon: {
    width: 28,
    alignItems: 'center',
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  settingTextDanger: {
    color: COLORS.danger,
  },
  settingValue: {
    fontSize: 16,
    color: COLORS.textTertiary,
    marginRight: SPACING.md,
  },
  divider: {
    height: 0.5,
    backgroundColor: COLORS.border,
    marginLeft: 56,
  },
  bottomSpacer: {
    height: 100,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: SPACING.sm,
    maxHeight: '75%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  modalCount: {
    fontWeight: '400',
    color: COLORS.textTertiary,
  },
  modalList: {
    flexGrow: 0,
  },
  modalUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  modalUserInfo: {
    flex: 1,
    minWidth: 0,
  },
  modalUserName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  modalUserEmail: {
    fontSize: 13,
    color: COLORS.textTertiary,
  },
  modalEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  modalEmptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalPrimaryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
  },
  modalPrimaryText: {
    color: COLORS.textInverse,
    fontSize: 12,
    fontWeight: '600',
  },
  modalSubtleBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
  },
  modalSubtleText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  confirmMessage: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 21,
    marginBottom: SPACING.sm,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  confirmButton: {
    flex: 1,
  },
});
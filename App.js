import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Animated,
  Alert,
  Platform,
  Vibration,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Safely detect if a native module is registered before requiring the JS package
const hasNativeModule = (moduleName) => {
  if (typeof globalThis === 'undefined') return false;
  
  // 1. Check global expo modules (new Expo Modules API)
  if (globalThis.expo?.modules?.[moduleName]) {
    return true;
  }
  
  // 2. Check legacy ExpoModules
  if (globalThis.ExpoModules?.[moduleName]) {
    return true;
  }

  try {
    // 3. Check via react-native NativeModules registry
    const { NativeModules } = require('react-native');
    if (NativeModules[moduleName]) {
      return true;
    }
  } catch (e) {}

  try {
    // 4. Check via expo-modules-core NativeModulesProxy
    const { NativeModulesProxy } = require('expo-modules-core');
    if (NativeModulesProxy[moduleName]) {
      return true;
    }
  } catch (e) {}

  return false;
};

// Safely load expo-av to prevent Expo Go SDK 54+ native module crashes
let Audio = null;
if (hasNativeModule('ExponentAV')) {
  try {
    Audio = require('expo-av').Audio;
  } catch (err) {
    console.warn('[BouncyHabits] Audio playback module found but failed to load:', err.message);
  }
} else {
  console.warn('[BouncyHabits] ExponentAV native module not found. Audio playback disabled, using vibration fallback.');
}

import { 
  Play, 
  Pause, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Clock, 
  Check, 
  X,
  Volume2,
  VolumeX
} from 'lucide-react-native';

// Safely load expo-notifications to prevent Expo Go SDK 53+ push notifications crashes
let Notifications = null;
const hasNotificationsNative = (
  hasNativeModule('ExpoNotificationPresenter') || 
  hasNativeModule('ExpoNotificationScheduler') ||
  hasNativeModule('ExpoNotificationBuilder')
);

if (hasNotificationsNative) {
  try {
    Notifications = require('expo-notifications');
  } catch (err) {
    console.warn('[BouncyHabits] Notifications module found but failed to load:', err.message);
  }
} else {
  console.warn('[BouncyHabits] Notification native modules not found. Scheduled reminders disabled.');
}

// Configure Notifications behavior safely
if (Notifications) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (err) {
    console.warn('[BouncyHabits] Failed to set notification handler:', err.message);
  }
}


const STORAGE_KEY = '@bouncy_habits_data';

export default function App() {
  // App States
  const [habits, setHabits] = useState([]);
  const [activeHabit, setActiveHabit] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMinutes, setNewMinutes] = useState('60');
  const [newReminderTime, setNewReminderTime] = useState('09:00'); // HH:MM

  // Refs for tracking timer intervals and audio
  const timerRef = useRef(null);
  const soundRef = useRef(null);
  const activeHabitIdRef = useRef(null);
  const scheduledNotificationIdRef = useRef(null);

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Load habits on mount
  useEffect(() => {
    loadHabits();
    requestNotificationPermissions();
    
    return () => {
      clearInterval(timerRef.current);
      unloadSound();
    };
  }, []);

  // Set active habit ID in ref for timer usage
  useEffect(() => {
    activeHabitIdRef.current = activeHabit ? activeHabit.id : null;
  }, [activeHabit]);

  // Handle pulse animation when timer is running
  useEffect(() => {
    let animationLoop;
    if (isTimerRunning) {
      animationLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      animationLoop.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (animationLoop) animationLoop.stop();
    };
  }, [isTimerRunning]);

  // Request notifications permission safely
  const requestNotificationPermissions = async () => {
    if (!Notifications) return;
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        Alert.alert('Permission Required', 'Enable notifications to receive habit reminders!');
      }
    } catch (err) {
      console.warn('Failed to request notification permission:', err.message);
    }
  };


  // Load state from Storage
  const loadHabits = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setHabits(parsed);
        if (parsed.length > 0) {
          selectHabit(parsed[0]);
        }
      } else {
        // Seed default habits
        const defaults = [
          { id: '1', title: 'Study Coding', duration: 3600, reminderTime: '09:00', notificationId: null },
          { id: '2', title: 'Exercise', duration: 1800, reminderTime: '17:00', notificationId: null },
          { id: '3', title: 'Drink Water', duration: 300, reminderTime: '11:00', notificationId: null },
        ];
        setHabits(defaults);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
        selectHabit(defaults[0]);
      }
    } catch (err) {
      console.error('Failed to load habits:', err);
    }
  };

  // Save state to Storage
  const saveHabitsToStorage = async (updatedHabits) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHabits));
    } catch (err) {
      console.error('Failed to save habits:', err);
    }
  };

  // Select a habit
  const selectHabit = (habit) => {
    clearInterval(timerRef.current);
    setIsTimerRunning(false);
    setActiveHabit(habit);
    setTimeLeft(habit.duration);
  };

  // Play audio alarm safely
  const playAlarm = async () => {
    if (!soundEnabled) return;
    if (!Audio) {
      // Fallback: system vibration if audio native module is missing in Expo Go
      Vibration.vibrate([500, 500, 500], true);
      return;
    }
    try {
      unloadSound();
      
      // Load custom alarm sound
      const { sound } = await Audio.Sound.createAsync(
        require('./assets/alarm.wav'),
        { shouldPlay: true, isLooping: true }
      );
      soundRef.current = sound;
    } catch (error) {
      console.log('Error playing sound file, playing default chime instead', error);
      // Fallback: system vibration and alert if audio fails
      Vibration.vibrate([500, 500, 500], true);
    }
  };

  // Unload audio resource
  const unloadSound = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {
        console.log('Error unloading sound:', e);
      }
      soundRef.current = null;
    }
    Vibration.cancel();
  };

  // Toggle Timer with bounce animation
  const handleTimerPress = () => {
    // Snappy bouncy animation: instantly shrink slightly for responsive tactile feedback, then spring back
    scaleAnim.setValue(0.92);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,      // Lower friction = bouncy spring back
      tension: 200,     // Higher tension = fast action
      useNativeDriver: true,
    }).start();

    if (isTimerRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  };

  // Start countdown timer safely
  const startTimer = async () => {
    if (timeLeft <= 0) return;
    
    setIsTimerRunning(true);

    // Schedule background OS notification for when the timer finishes
    if (activeHabit && Notifications) {
      try {
        // Cancel any existing running notifications
        if (scheduledNotificationIdRef.current) {
          await Notifications.cancelScheduledNotificationAsync(scheduledNotificationIdRef.current);
        }

        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Timer Finished!',
            body: `Congrats! You completed your session for "${activeHabit.title}".`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority?.HIGH,
          },
          trigger: {
            seconds: timeLeft,
          },
        });
        scheduledNotificationIdRef.current = notificationId;
      } catch (err) {
        console.log('Failed to schedule timer finish notification:', err);
      }
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setIsTimerRunning(false);
          triggerTimerFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Pause timer safely
  const pauseTimer = async () => {
    clearInterval(timerRef.current);
    setIsTimerRunning(false);
    
    // Cancel the running timer notification
    if (scheduledNotificationIdRef.current && Notifications) {
      try {
        await Notifications.cancelScheduledNotificationAsync(scheduledNotificationIdRef.current);
        scheduledNotificationIdRef.current = null;
      } catch (err) {
        console.log('Failed to cancel timer notification:', err);
      }
    }
  };


  // Reset timer
  const resetTimer = () => {
    pauseTimer();
    unloadSound();
    if (activeHabit) {
      setTimeLeft(activeHabit.duration);
    }
  };

  // Trigger when countdown finishes
  const triggerTimerFinish = () => {
    playAlarm();
    Alert.alert(
      'Session Done! 🎉',
      `Time's up for: ${activeHabit ? activeHabit.title : 'your habit'}!`,
      [
        {
          text: 'Stop Alarm',
          onPress: () => unloadSound(),
          style: 'cancel',
        },
      ],
      { cancelable: false }
    );
  };

  // Add a new habit
  const handleCreateHabit = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Error', 'Please enter a habit title.');
      return;
    }

    const durationSeconds = parseInt(newMinutes, 10) * 60;
    if (isNaN(durationSeconds) || durationSeconds <= 0) {
      Alert.alert('Error', 'Please enter a valid duration.');
      return;
    }

    // Parse reminder time (HH:MM)
    const timeMatch = newReminderTime.match(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/);
    if (!timeMatch) {
      Alert.alert('Error', 'Please enter reminder time in HH:MM format.');
      return;
    }
    const [_, hhStr, mmStr] = timeMatch;
    const hour = parseInt(hhStr, 10);
    const minute = parseInt(mmStr, 10);

    // Schedule Daily Reminder Notification safely
    let notificationId = null;
    if (Notifications) {
      try {
        notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Habit Reminder ⏰',
            body: `Time to start your habit: "${newTitle}"`,
            sound: true,
          },
          trigger: {
            hour,
            minute,
            repeats: true,
          },
        });
      } catch (err) {
        console.log('Failed to schedule daily reminder:', err);
      }
    }

    const newHabit = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      duration: durationSeconds,
      reminderTime: newReminderTime,
      notificationId,
    };

    const updatedHabits = [...habits, newHabit];
    setHabits(updatedHabits);
    saveHabitsToStorage(updatedHabits);
    selectHabit(newHabit);

    // Reset form
    setNewTitle('');
    setNewMinutes('60');
    setNewReminderTime('09:00');
    setIsModalOpen(false);
  };

  // Delete a habit
  const handleDeleteHabit = async (habitId) => {
    Alert.alert(
      'Delete Habit',
      'Are you sure you want to delete this habit?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const habitToDelete = habits.find((h) => h.id === habitId);
            
            // Cancel daily notification reminder safely
            if (habitToDelete && habitToDelete.notificationId && Notifications) {
              try {
                await Notifications.cancelScheduledNotificationAsync(habitToDelete.notificationId);
              } catch (err) {
                console.log('Failed to cancel reminder notification:', err);
              }
            }


            const updated = habits.filter((h) => h.id !== habitId);
            setHabits(updated);
            saveHabitsToStorage(updated);

            // If active habit was deleted, select another one
            if (activeHabit && activeHabit.id === habitId) {
              if (updated.length > 0) {
                selectHabit(updated[0]);
              } else {
                setActiveHabit(null);
                setTimeLeft(0);
              }
            }
          },
        },
      ]
    );
  };

  // Format seconds to HH:MM:SS or MM:SS
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const pad = (num) => String(num).padStart(2, '0');

    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  // Calculate circular progress percentage
  const getProgress = () => {
    if (!activeHabit || activeHabit.duration === 0) return 0;
    return (timeLeft / activeHabit.duration) * 100;
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>BouncyHabits</Text>
        <TouchableOpacity 
          style={styles.soundButton}
          onPress={() => {
            setSoundEnabled(!soundEnabled);
            if (soundEnabled) unloadSound();
          }}
        >
          {soundEnabled ? (
            <Volume2 color="#a855f7" size={24} />
          ) : (
            <VolumeX color="#8e94a5" size={24} />
          )}
        </TouchableOpacity>
      </View>

      {/* Main Timer Display */}
      <View style={styles.timerContainer}>
        {activeHabit ? (
          <View style={styles.timerSubContainer}>
            <Text style={styles.activeHabitName}>{activeHabit.title}</Text>
            
            {/* Interactive Bouncy Timer Button */}
            <Animated.View
              style={[
                styles.bouncyButtonContainer,
                {
                  transform: [
                    { scale: scaleAnim },
                    { scale: pulseAnim }
                  ]
                }
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleTimerPress}
                onLongPress={resetTimer}
                style={styles.timerButton}
              >
                <Text 
                  style={[
                    styles.timerText,
                    timeLeft >= 3600 && { fontSize: 32 }
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatTime(timeLeft)}
                </Text>
                <Text style={styles.tapPrompt}>
                  {isTimerRunning ? 'Tap to Pause' : 'Tap to Start'}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Quick Control Buttons */}
            <View style={styles.controlsRow}>
              <TouchableOpacity style={styles.iconButton} onPress={resetTimer}>
                <RotateCcw color="#8e94a5" size={22} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.timerSubContainer}>
            <Text style={styles.noHabitsText}>No habits active</Text>
            <Text style={styles.noHabitsSubtext}>Add a habit below to get started</Text>
          </View>
        )}
      </View>

      {/* Habit List Section */}
      <View style={styles.listSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Daily Habits & Reminders</Text>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setIsModalOpen(true)}
          >
            <Plus color="#ffffff" size={20} />
            <Text style={styles.addButtonText}>Add New</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollList}
          contentContainerStyle={styles.scrollListContent}
        >
          {habits.map((item) => {
            const isSelected = activeHabit && activeHabit.id === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.habitCard,
                  isSelected && styles.selectedHabitCard
                ]}
                onPress={() => selectHabit(item)}
              >
                <View style={styles.habitCardLeft}>
                  <Text style={[
                    styles.habitCardTitle,
                    isSelected && styles.selectedHabitCardTitle
                  ]}>
                    {item.title}
                  </Text>
                  <View style={styles.habitMetaRow}>
                    <Clock size={14} color="#8e94a5" />
                    <Text style={styles.habitMetaText}>
                      {Math.round(item.duration / 60)} mins
                    </Text>
                    <Text style={styles.habitDot}>•</Text>
                    <Text style={styles.habitMetaText}>
                      Reminder at {item.reminderTime}
                    </Text>
                  </View>
                </View>
                
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteHabit(item.id)}
                >
                  <Trash2 color="#f43f5e" size={18} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
          {habits.length === 0 && (
            <Text style={styles.emptyListText}>Your habits list is empty.</Text>
          )}
        </ScrollView>
      </View>

      {/* Add Habit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Habit</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <X color="#8e94a5" size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Habit Name / Task</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Study Chemistry, Workout"
                placeholderTextColor="#5a5e73"
                value={newTitle}
                onChangeText={setNewTitle}
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.label}>Duration (minutes)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="60"
                  placeholderTextColor="#5a5e73"
                  value={newMinutes}
                  onChangeText={setNewMinutes}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>Reminder (HH:MM)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="09:00"
                  placeholderTextColor="#5a5e73"
                  value={newReminderTime}
                  onChangeText={setNewReminderTime}
                />
              </View>
            </View>

            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleCreateHabit}
            >
              <Check color="#ffffff" size={20} />
              <Text style={styles.submitButtonText}>Create Habit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0e15',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#161824',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  soundButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#161824',
  },
  timerContainer: {
    flex: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  timerSubContainer: {
    alignItems: 'center',
    width: '100%',
  },
  activeHabitName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#a855f7',
    marginBottom: 25,
    textAlign: 'center',
  },
  bouncyButtonContainer: {
    width: 250,
    height: 250,
    borderRadius: 125,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
  },
  timerButton: {
    width: '100%',
    height: '100%',
    borderRadius: 125,
    backgroundColor: '#161824',
    borderWidth: 4,
    borderColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 8,
  },
  timerText: {
    fontSize: 46,
    fontWeight: 'bold',
    color: '#ffffff',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  tapPrompt: {
    fontSize: 14,
    color: '#8e94a5',
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '500',
  },
  controlsRow: {
    flexDirection: 'row',
    marginTop: 30,
    alignItems: 'center',
  },
  iconButton: {
    backgroundColor: '#161824',
    padding: 12,
    borderRadius: 30,
    marginHorizontal: 15,
  },
  noHabitsText: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: '500',
    marginBottom: 8,
  },
  noHabitsSubtext: {
    fontSize: 14,
    color: '#8e94a5',
  },
  listSection: {
    flex: 1,
    backgroundColor: '#11121c',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  addButton: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 4,
  },
  scrollList: {
    flex: 1,
  },
  scrollListContent: {
    paddingBottom: 20,
  },
  habitCard: {
    flexDirection: 'row',
    backgroundColor: '#161824',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2235',
  },
  selectedHabitCard: {
    borderColor: '#6366f1',
    backgroundColor: '#1b1d30',
  },
  habitCardLeft: {
    flex: 1,
  },
  habitCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1f3f9',
    marginBottom: 6,
  },
  selectedHabitCardTitle: {
    color: '#ffffff',
  },
  habitMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  habitMetaText: {
    fontSize: 12,
    color: '#8e94a5',
    marginLeft: 4,
  },
  habitDot: {
    fontSize: 12,
    color: '#8e94a5',
    marginHorizontal: 6,
  },
  deleteButton: {
    padding: 8,
  },
  emptyListText: {
    color: '#8e94a5',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 6, 10, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#161824',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#24283b',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  formGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#8e94a5',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#0d0e15',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#24283b',
  },
  submitButton: {
    backgroundColor: '#a855f7',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 10,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 6,
  },
});

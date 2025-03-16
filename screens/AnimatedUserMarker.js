// AnimatedUserMarker.js
import { useCallback } from 'react';
import Animated, { Easing, useSharedValue, useAnimatedProps, withTiming } from 'react-native-reanimated';
import React, { useEffect } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { MarkerView } from '@rnmapbox/maps';
import { Avatar } from '@rneui/themed';

// Hook to manage animated coordinates
export const useAnimatedCoord = (initialCoordinate) => {
  const [initialLong, initialLat] = initialCoordinate;
  const longitude = useSharedValue(initialLong);
  const latitude = useSharedValue(initialLat);

  const animatedProps = useAnimatedProps(() => {
    return {
      coordinate: [longitude.value, latitude.value],
    };
  }, [longitude, latitude]);

  const animate = useCallback((newCoordinate, options = {}) => {
    const { duration = 1000, easing = Easing.linear } = options;
    const [newLong, newLat] = newCoordinate;

    longitude.value = withTiming(newLong, { duration, easing });
    latitude.value = withTiming(newLat, { duration, easing });
  }, [longitude, latitude]);

  return [animatedProps, animate];
};

// Create an animated MarkerView component
const AnimatedMarkerView = Animated.createAnimatedComponent(MarkerView);

const AnimatedUserMarker = ({ user, onPress }) => {
  const [animatedProps, animate] = useAnimatedCoord([
    user.location.longitude,
    user.location.latitude,
  ]);

  // Animate when the user's location changes
  useEffect(() => {
    animate([user.location.longitude, user.location.latitude], {
      duration: 1000,
      easing: Easing.inOut(Easing.ease),
    });
  }, [user.location.longitude, user.location.latitude, animate]);

  return (
    <AnimatedMarkerView
      id={user.uid}
      animatedProps={animatedProps}
      anchor={{ x: 0.5, y: 0.5 }}
      allowOverlap={true}
      allowOverlapWithPuck={true}
    >
      <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        <View style={markerStyles.container}>
          <Avatar
            rounded
            source={
              user.avatar && user.avatar.link
                ? { uri: user.avatar.link }
                : { uri: 'data:image/png' }
            }
            icon={
              !user.avatar || !user.avatar.link
                ? { name: 'person-outline', type: 'material', size: 24 }
                : undefined
            }
            size={30}
            containerStyle={
              !user.avatar || !user.avatar.link
                ? { backgroundColor: '#c2c2c2' }
                : {}
            }
          />
          <Text style={markerStyles.nameText}>{user.firstName}</Text>
        </View>
      </TouchableOpacity>
    </AnimatedMarkerView>
  );
};

// Styles
const markerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'gray',
  },
  nameText: {
    color: 'black',
    marginLeft: 5,
    fontSize: 16,
  },
});

export default AnimatedUserMarker;
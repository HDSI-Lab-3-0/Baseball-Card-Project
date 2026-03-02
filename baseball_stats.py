import cv2
import time
import numpy as np

# =========================
# USER SETTINGS
# =========================
REAL_DISTANCE_FEET = 10      # Distance between Line 1 and Line 2
MIN_RADIUS = 15              # Minimum radius to detect ball
# =========================

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Cannot open camera")
    exit()
else:
    print("Camera opened successfully!")

prev_center = None
cross_time_1 = None
cross_time_2 = None
pitch_speed = None

while True:
    ret, frame = cap.read()
    if not ret:
        print("Failed to grab frame")
        break

    frame_height, frame_width = frame.shape[:2]
    mid_x = frame_width // 2

    # Auto-center the timing lines relative to middle
    LINE1_X = mid_x - frame_width // 6  # Start line (blue)
    LINE2_X = mid_x + frame_width // 6  # End line (red)

    # Convert frame to HSV for green ball detection
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    lower_green = np.array([35, 80, 80])
    upper_green = np.array([85, 255, 255])
    mask = cv2.inRange(hsv, lower_green, upper_green)
    mask = cv2.GaussianBlur(mask, (7, 7), 0)

    # Find contours
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if contours:
        c = max(contours, key=cv2.contourArea)
        ((x, y), radius) = cv2.minEnclosingCircle(c)

        if radius > MIN_RADIUS:
            center = (int(x), int(y))
            current_x = center[0]

            # Draw the detected ball
            cv2.circle(frame, center, int(radius), (0, 255, 0), 2)

            if prev_center is not None:
                prev_x = prev_center[0]

                # Line 1 crossing
                if cross_time_1 is None and prev_x < LINE1_X <= current_x:
                    cross_time_1 = time.time()
                    print("Crossed Line 1 (Blue)")

                # Line 2 crossing only if Line 1 was crossed
                elif cross_time_1 is not None and cross_time_2 is None and prev_x < LINE2_X <= current_x:
                    cross_time_2 = time.time()
                    print("Crossed Line 2 (Red)")

                    # Calculate speed
                    dt = cross_time_2 - cross_time_1
                    if dt > 0:
                        speed_fps = REAL_DISTANCE_FEET / dt
                        pitch_speed = speed_fps * 0.6818  # ft/s to mph
                        print(f"PITCH SPEED: {pitch_speed:.1f} mph")

                    # Reset for next pitch
                    cross_time_1 = None
                    cross_time_2 = None

            prev_center = center

    # Draw timing lines
    cv2.line(frame, (LINE1_X, 0), (LINE1_X, frame_height), (255, 0, 0), 3)  # Blue - Line 1
    cv2.line(frame, (mid_x, 0), (mid_x, frame_height), (0, 255, 0), 2)      # Green - Center reference
    cv2.line(frame, (LINE2_X, 0), (LINE2_X, frame_height), (0, 0, 255), 3)  # Red - Line 2

    # Display pitch speed
    if pitch_speed is not None:
        cv2.putText(frame, f"{pitch_speed:.1f} mph",
                    (50, 60),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1.5,
                    (0, 255, 255),
                    3)

    cv2.imshow("Pitch Speed Tracker", frame)

    # ESC to exit
    if cv2.waitKey(1) & 0xFF == 27:
        break

cap.release()
cv2.destroyAllWindows()
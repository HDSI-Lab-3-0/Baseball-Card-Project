import cv2
import time
import numpy as np

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Cannot open camera")
    exit()
else:
    print("Camera opened successfully!")

# Previous frame coordinates
prev_center = None
prev_time = None

# Real-world calibration (meters per pixel)
meters_per_pixel = 0.01  # adjust based on your setup

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # Convert to HSV for easier color tracking (assume white baseball)
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

    # Threshold for white ball
    lower_white = np.array([0, 50, 50])
    upper_white = np.array([180, 255, 255])
    mask = cv2.inRange(hsv, lower_white, upper_white)

    # Find contours
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if contours:
        # Find largest contour (assume it’s the ball)
        c = max(contours, key=cv2.contourArea)
        ((x, y), radius) = cv2.minEnclosingCircle(c)

        if radius > 5:  # filter out noise
            center = (int(x), int(y))
            cv2.circle(frame, center, int(radius), (0, 255, 0), 2)

            # Calculate speed
            if prev_center is not None and prev_time is not None:
                dx = center[0] - prev_center[0]
                dy = center[1] - prev_center[1]
                dist_pixels = np.sqrt(dx**2 + dy**2)
                dist_meters = dist_pixels * meters_per_pixel

                dt = time.time() - prev_time
                speed_mps = dist_meters / dt
                speed_mph = speed_mps * 2.237
                cv2.putText(frame, f"{speed_mph:.1f} mph", (50,50),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0,255,0), 2)
            prev_center = center
            prev_time = time.time()

    cv2.imshow('Ball Tracking', frame)

    if cv2.waitKey(1) & 0xFF == 27:  # ESC to quit
        break

cap.release()
cv2.destroyAllWindows()

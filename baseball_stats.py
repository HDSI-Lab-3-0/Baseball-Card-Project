import cv2
import time
import numpy as np


cap = cv2.VideoCapture(0)


if not cap.isOpened():
   print("Cannot open camera")
   exit()
else:
   print("Camera opened successfully!")


prev_center = None
prev_time = None
max_speed = 0


meters_per_pixel = 0.01
MIN_PIXEL_MOVEMENT = 15  # ignore movements smaller than this


while True:
   ret, frame = cap.read()
   if not ret:
       break


   hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)


   lower_green = np.array([35, 80, 80])
   upper_green = np.array([85, 255, 255])
   mask = cv2.inRange(hsv, lower_green, upper_green)


   contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)


   if contours:
       c = max(contours, key=cv2.contourArea)
       ((x, y), radius) = cv2.minEnclosingCircle(c)


       if radius > 20:
           center = (int(x), int(y))
           cv2.circle(frame, center, int(radius), (0, 255, 0), 2)


           if prev_center is not None and prev_time is not None:
               dx = center[0] - prev_center[0]
               dy = center[1] - prev_center[1]
               dist_pixels = np.sqrt(dx**2 + dy**2)
               
               # Only calculate speed if ball moved enough
               if dist_pixels > MIN_PIXEL_MOVEMENT:
                   dist_meters = dist_pixels * meters_per_pixel
                   dt = time.time() - prev_time
                   speed_mps = dist_meters / dt
                   speed_mph = speed_mps * 2.237
                   
                   print(f"Speed: {speed_mph:.1f} mph | Position: ({center[0]}, {center[1]}) | Radius: {radius:.0f}px")
                   
                   if speed_mph > max_speed:
                       max_speed = speed_mph
                       print(f">>> NEW MAX: {max_speed:.1f} mph <<<")
                   
                   cv2.putText(frame, f"{speed_mph:.1f} mph", (50, 50),
                               cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                   
                   # Only update prev values when there's real movement
                   prev_center = center
                   prev_time = time.time()
               else:
                   cv2.putText(frame, "Stationary", (50, 50),
                               cv2.FONT_HERSHEY_SIMPLEX, 1, (100, 100, 100), 2)
           else:
               prev_center = center
               prev_time = time.time()
           
           cv2.putText(frame, f"Max: {max_speed:.1f} mph", (50, 90),
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)


   cv2.imshow('Ball Tracking', frame)


   if cv2.waitKey(1) & 0xFF == 27:
       break

print(f"\n=== SESSION MAX SPEED: {max_speed:.1f} mph ===")
cap.release()
cv2.destroyAllWindows()
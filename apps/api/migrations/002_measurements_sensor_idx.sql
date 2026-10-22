-- lastMeasurementAt czujnika oraz FK ON DELETE SET NULL przy wyrejestrowaniu.
CREATE INDEX measurements_sensor_idx ON measurements (sensor_id, timestamp);
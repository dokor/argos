import java.time.Duration;

/** Run against the deployed JAR and its environment; print only non-secret durations. */
public class ArgosSessionSettingsProbe {
    public static void main(String[] args) {
        try {
            Class<?> config = Class.forName("com.typesafe.config.Config");
            Object loaded = Class.forName("com.typesafe.config.ConfigFactory").getMethod("load").invoke(null);
            Class<?> type = Class.forName("com.dokor.argos.services.account.AccountSettings");
            Object settings = type.getConstructor(config).newInstance(loaded);
            long absolute = ((Duration) type.getMethod("absoluteTtl").invoke(settings)).toSeconds();
            long idle = ((Duration) type.getMethod("idleTtl").invoke(settings)).toSeconds();
            long jwt = ((Duration) type.getMethod("jwtTtl").invoke(settings)).toSeconds();
            long recent = ((Duration) type.getMethod("recentTtl").invoke(settings)).toSeconds();
            System.out.printf("{\"sessionSeconds\":%d,\"idleSeconds\":%d,\"jwtSeconds\":%d,\"recentSeconds\":%d}%n", absolute, idle, jwt, recent);
        } catch (Throwable failure) {
            System.out.println("{\"error\":\"settings-probe-failed\"}");
            System.exit(1);
        }
    }
}

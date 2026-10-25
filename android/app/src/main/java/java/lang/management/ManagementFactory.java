package java.lang.management;

/**
 * Android has no java.lang.management; pgjdbc (the Postgres driver) touches it
 * from one place — the maxResultBuffer check — so these stubs satisfy the
 * link without pretending to be a real JVM.
 */
public final class ManagementFactory {
    private ManagementFactory() {}

    public static MemoryMXBean getMemoryMXBean() {
        return new MemoryMXBean() {
            @Override
            public MemoryUsage getHeapMemoryUsage() {
                return new MemoryUsage(Runtime.getRuntime().maxMemory());
            }
        };
    }
}

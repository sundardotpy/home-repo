package java.lang.management;

public class MemoryUsage {
    private final long max;

    public MemoryUsage(long max) {
        this.max = max;
    }

    public long getMax() {
        return max;
    }
}

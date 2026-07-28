package com.example.affine;

/**
 * A 2D affine transform represented as a 3x3 matrix with an implicit
 * bottom row of (0, 0, 1):
 *
 * <pre>
 * | m00 m01 m02 |
 * | m10 m11 m12 |
 * |  0   0   1  |
 * </pre>
 */
public final class AffineMatrix {

    public final double m00, m01, m02;
    public final double m10, m11, m12;

    public AffineMatrix(double m00, double m01, double m02, double m10, double m11, double m12) {
        this.m00 = m00;
        this.m01 = m01;
        this.m02 = m02;
        this.m10 = m10;
        this.m11 = m11;
        this.m12 = m12;
    }

    public static AffineMatrix identity() {
        return new AffineMatrix(1, 0, 0, 0, 1, 0);
    }

    public static AffineMatrix translate(double tx, double ty) {
        return new AffineMatrix(1, 0, tx, 0, 1, ty);
    }

    public static AffineMatrix rotate(double degrees) {
        double rad = Math.toRadians(degrees);
        double c = Math.cos(rad);
        double s = Math.sin(rad);
        return new AffineMatrix(c, -s, 0, s, c, 0);
    }

    public static AffineMatrix scale(double sx, double sy) {
        return new AffineMatrix(sx, 0, 0, 0, sy, 0);
    }

    public static AffineMatrix shear(double shx, double shy) {
        return new AffineMatrix(1, shx, 0, shy, 1, 0);
    }

    /**
     * Returns {@code this . other}, i.e. this matrix post-multiplied by
     * {@code other} (this on the left, other on the right).
     */
    public AffineMatrix multiply(AffineMatrix other) {
        double r00 = this.m00 * other.m00 + this.m01 * other.m10;
        double r01 = this.m00 * other.m01 + this.m01 * other.m11;
        double r02 = this.m00 * other.m02 + this.m01 * other.m12 + this.m02;

        double r10 = this.m10 * other.m00 + this.m11 * other.m10;
        double r11 = this.m10 * other.m01 + this.m11 * other.m11;
        double r12 = this.m10 * other.m02 + this.m11 * other.m12 + this.m12;

        return new AffineMatrix(r00, r01, r02, r10, r11, r12);
    }

    public double det() {
        return m00 * m11 - m01 * m10;
    }

    public double[] apply(double x, double y) {
        double rx = m00 * x + m01 * y + m02;
        double ry = m10 * x + m11 * y + m12;
        return new double[] {rx, ry};
    }

    /**
     * Returns the inverse of this affine matrix. Only valid when
     * {@link #det()} is non-zero.
     */
    public AffineMatrix inverse() {
        double det = det();
        double inv00 = m11 / det;
        double inv01 = -m01 / det;
        double inv10 = -m10 / det;
        double inv11 = m00 / det;
        double inv02 = -(inv00 * m02 + inv01 * m12);
        double inv12 = -(inv10 * m02 + inv11 * m12);
        return new AffineMatrix(inv00, inv01, inv02, inv10, inv11, inv12);
    }
}

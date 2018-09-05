FROM amazonlinux:latest

RUN yum -y install unzip aws-cli
ADD build-citygml.sh /tmp/build-citygml.sh
ADD out/artifacts/citygml/citygml.jar /tmp/citygml.jar
RUN chmod 755 /tmp/*.sh
WORKDIR /tmp
USER nobody

ENTRYPOINT ["/tmp/build-citygml.sh"]